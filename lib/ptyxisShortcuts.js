// SPDX-License-Identifier: GPL-2.0-or-later
//
// GTK 4 does not match shortcuts like Ctrl+Shift+V while a non-Latin
// layout is active (https://gitlab.gnome.org/GNOME/gtk/-/issues/5537),
// so in Ptyxis copy, paste and the rest stop working on e.g. Russian.
// Work around it by rewriting Ptyxis shortcuts to the symbols the same
// physical keys produce in the current layout, and back on Latin ones.
//
// This module avoids Shell imports so it can be tested with plain gjs.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

export const PTYXIS_SCHEMA = 'org.gnome.Ptyxis.Shortcuts';
const FALLBACK_LAYOUT = 'us';
// Modifiers followed by a single Latin letter, e.g. <ctrl><shift>v
const LETTER_TRIGGER = /^((?:<[^>]+>)*)([a-z])$/i;
const LATIN_LETTER = /^[a-z]$/i;
const LAYOUT_NAME = /^[\w-]+$/;

/**
 * @param {Map<string, string>} keymap - from compileKeymap()
 * @returns {boolean} whether the layout types Latin letters
 */
function isLatin(keymap) {
    return [...keymap.values()].includes('a');
}

/**
 * Compiles an xkb layout with xkbcomp.
 *
 * @param {string} xkbId - a layout with an optional variant: "ru", "us+dvorak"
 * @returns {Promise<Map<string, string>>} xkb key names (AB04) mapped to
 *   their first-level keysym (Cyrillic_em)
 */
export async function compileKeymap(xkbId) {
    const [layout, variant] = xkbId.split('+');
    if (!LAYOUT_NAME.test(layout) || (variant && !LAYOUT_NAME.test(variant)))
        throw new Error(`unexpected layout ${xkbId}`);
    const symbols = `pc+${layout}${variant ? `(${variant})` : ''}`;
    const source = `xkb_keymap {
        xkb_keycodes { include "evdev+aliases(qwerty)" };
        xkb_types { include "complete" };
        xkb_compat { include "complete" };
        xkb_symbols { include "${symbols}" };
    };`;
    const proc = Gio.Subprocess.new(
        ['xkbcomp', '-xkb', '-I/usr/share/X11/xkb', '-', '-'],
        Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE |
        Gio.SubprocessFlags.STDERR_SILENCE);
    const [stdout] = await proc.communicate_utf8_async(source, null);
    if (!proc.get_successful())
        throw new Error(`xkbcomp failed for ${xkbId}`);

    const keymap = new Map();
    const keyRe = /key <(\w+)>\s*\{[^}]*?symbols\[Group1\]\s*=\s*\[\s*([^,\s\]]+)/g;
    for (const [, keyName, sym] of stdout.matchAll(keyRe))
        keymap.set(keyName, sym);
    return keymap;
}

/**
 * Keeps Ptyxis shortcuts working on the current keyboard layout.
 */
export class PtyxisShortcuts {
    /**
     * @param {Gio.Settings} settings - the extension settings, which keep
     *   the original shortcuts while translated ones are in place
     * @param {Gio.Settings} ptyxis - org.gnome.Ptyxis.Shortcuts
     * @param {object} inputSources - the Shell InputSourceManager, or
     *   anything with inputSources, currentSource and its signals
     */
    constructor(settings, ptyxis, inputSources) {
        this._settings = settings;
        this._ptyxis = ptyxis;
        this._inputSources = inputSources;
        this._keymaps = new Map();
        this._written = new Map();
        this._serial = 0;
        this._enabled = false;
    }

    /** @returns {Promise<void>} resolves once shortcuts match the layout */
    enable() {
        this._enabled = true;
        this._written.clear();
        this._sourceChangedId = this._inputSources.connect('current-source-changed',
            () => this.update());
        this._ptyxisChangedId = this._ptyxis.connect('changed',
            (settings, key) => this._onPtyxisChanged(key));
        return this.update();
    }

    disable() {
        if (!this._enabled)
            return;
        this._enabled = false;
        this._serial++;
        this._inputSources.disconnect(this._sourceChangedId);
        this._ptyxis.disconnect(this._ptyxisChangedId);
        this._restore();
    }

    /** @returns {Promise<void>} resolves once shortcuts match the layout */
    async update() {
        const serial = ++this._serial;
        try {
            const current = this._inputSources.currentSource?.xkbId;
            if (!current)
                return;
            const baseMap = await this._getLatinKeymap();
            const currentMap = await this._getKeymap(current);
            if (serial !== this._serial)
                return;

            // GTK finds the letters of Latin layouts itself, wherever they are
            if (isLatin(currentMap)) {
                this._restore();
                return;
            }

            const keyForLetter = new Map();
            for (const [keyName, sym] of baseMap) {
                if (LATIN_LETTER.test(sym) && !keyForLetter.has(sym.toLowerCase()))
                    keyForLetter.set(sym.toLowerCase(), keyName);
            }

            const base = this._getBase();
            this._setBase(base);
            for (const [key, trigger] of Object.entries(base)) {
                const match = trigger.match(LETTER_TRIGGER);
                const sym = match &&
                    currentMap.get(keyForLetter.get(match[2].toLowerCase()));
                this._write(key, sym ? `${match[1]}${sym}` : trigger);
            }
        } catch (e) {
            console.warn(`Shift Copy: cannot adapt Ptyxis shortcuts: ${e.message}`);
        }
    }

    _getSaved() {
        return this._settings.get_value('ptyxis-base-shortcuts').deepUnpack();
    }

    _setBase(base) {
        this._settings.set_value('ptyxis-base-shortcuts',
            new GLib.Variant('a{ss}', base));
    }

    // The shortcuts as the user set them
    _getBase() {
        const saved = this._getSaved();
        if (Object.keys(saved).length)
            return saved;
        const base = {};
        for (const key of this._ptyxis.settings_schema.list_keys()) {
            const trigger = this._ptyxis.get_string(key);
            if (LETTER_TRIGGER.test(trigger))
                base[key] = trigger;
        }
        return base;
    }

    _write(key, trigger) {
        if (this._ptyxis.get_string(key) === trigger)
            return;
        this._written.set(key, trigger);
        this._ptyxis.set_string(key, trigger);
    }

    _restore() {
        const saved = this._getSaved();
        if (!Object.keys(saved).length)
            return;
        for (const [key, trigger] of Object.entries(saved))
            this._write(key, trigger);
        this._setBase({});
    }

    _onPtyxisChanged(key) {
        const value = this._ptyxis.get_string(key);
        if (this._written.get(key) === value) {
            this._written.delete(key);
            return;
        }
        // The user edited a shortcut while ours are in place: keep their
        // choice as the base and translate it again
        const saved = this._getSaved();
        if (!Object.keys(saved).length)
            return;
        saved[key] = value;
        this._setBase(saved);
        this.update();
    }

    // The first configured Latin layout says which physical key a letter
    // in a shortcut belongs to
    async _getLatinKeymap() {
        for (const source of Object.values(this._inputSources.inputSources)) {
            const keymap = await this._getKeymap(source.xkbId).catch(() => null);
            if (keymap && isLatin(keymap))
                return keymap;
        }
        return this._getKeymap(FALLBACK_LAYOUT);
    }

    async _getKeymap(xkbId) {
        if (!this._keymaps.has(xkbId))
            this._keymaps.set(xkbId, compileKeymap(xkbId));
        try {
            return await this._keymaps.get(xkbId);
        } catch (e) {
            this._keymaps.delete(xkbId);
            throw e;
        }
    }
}
