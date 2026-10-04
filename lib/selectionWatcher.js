// SPDX-License-Identifier: GPL-2.0-or-later
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

const TEXT_MIMETYPES = [
    'text/plain;charset=utf-8',
    'UTF8_STRING',
    'text/plain',
    'STRING',
];

// KeePassXC and KDE apps mark copied passwords with this type
const SECRET_MIMETYPE = 'x-kde-passwordManagerHint';

const MODIFIER_MASKS = {
    shift: Clutter.ModifierType.SHIFT_MASK,
    ctrl: Clutter.ModifierType.CONTROL_MASK,
    alt: Clutter.ModifierType.MOD1_MASK,
    super: Clutter.ModifierType.SUPER_MASK | Clutter.ModifierType.MOD4_MASK,
};

// Apps update the primary selection many times while the mouse drags,
// so wait for it to settle before copying
const SETTLE_MS = 150;

/**
 * Copies the primary selection (what is selected with the mouse) to the
 * clipboard when the chosen modifiers are held while selecting, and
 * reports text that lands in the clipboard.
 */
export class SelectionWatcher {
    /**
     * @param {Gio.Settings} settings - the extension settings
     * @param {function(string): void} onClipboardText - called with text
     *   copied to the clipboard, except passwords
     */
    constructor(settings, onClipboardText) {
        this._settings = settings;
        this._onClipboardText = onClipboardText;
        this._modifierSeen = false;
        this._settleId = 0;
    }

    enable() {
        this._clipboard = St.Clipboard.get_default();
        this._selection = global.display.get_selection();
        this._ownerChangedId = this._selection.connect('owner-changed',
            this._onOwnerChanged.bind(this));
    }

    disable() {
        if (this._settleId) {
            GLib.source_remove(this._settleId);
            this._settleId = 0;
        }
        this._selection.disconnect(this._ownerChangedId);
        this._selection = null;
        this._clipboard = null;
    }

    _getText(type) {
        // When a selection holds no text, get_text() runs the callback
        // before returning, which crashes GNOME Shell 49 to 51. So only
        // call it when the selection offers one of the text types that
        // St.Clipboard reads (supported_mimetypes in st-clipboard.c).
        const mimetypes = this._clipboard.get_mimetypes(type);
        if (!mimetypes.some(m => TEXT_MIMETYPES.includes(m)))
            return Promise.resolve(null);
        return new Promise(resolve => {
            this._clipboard.get_text(type, (clipboard, text) => resolve(text));
        });
    }

    _onOwnerChanged(selection, selectionType, source) {
        if (!source)
            return;
        if (selectionType === Meta.SelectionType.SELECTION_PRIMARY)
            this._onPrimaryChanged();
        else if (selectionType === Meta.SelectionType.SELECTION_CLIPBOARD)
            this._onClipboardChanged();
    }

    _onPrimaryChanged() {
        if (!this._settings.get_boolean('copy-on-select'))
            return;
        // Check the modifiers now, while the user is still selecting:
        // they may be released by the time the selection settles. All
        // chosen modifiers must be held; with none chosen, copy always.
        const [, , mods] = global.get_pointer();
        if (this._settings.get_strv('copy-modifiers')
            .every(m => mods & (MODIFIER_MASKS[m] ?? 0)))
            this._modifierSeen = true;

        if (this._settleId)
            GLib.source_remove(this._settleId);
        this._settleId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SETTLE_MS, () => {
            this._settleId = 0;
            if (this._modifierSeen)
                this._copyPrimary();
            this._modifierSeen = false;
            return GLib.SOURCE_REMOVE;
        });
    }

    async _copyPrimary() {
        const text = await this._getText(St.ClipboardType.PRIMARY);
        if (!this._clipboard || !text)
            return;
        // Apps like VS Code may have copied it already
        const current = await this._getText(St.ClipboardType.CLIPBOARD);
        if (this._clipboard && current !== text)
            this._clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    }

    async _onClipboardChanged() {
        const mimetypes = this._clipboard.get_mimetypes(St.ClipboardType.CLIPBOARD);
        if (mimetypes.includes(SECRET_MIMETYPE))
            return;
        const text = await this._getText(St.ClipboardType.CLIPBOARD);
        if (this._clipboard && text)
            this._onClipboardText(text);
    }
}
