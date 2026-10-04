// SPDX-License-Identifier: GPL-2.0-or-later
import GLib from 'gi://GLib';

/**
 * Recent clipboard texts, newest first. Follows the history-size and
 * persist-history settings and, when asked, keeps the list in a file
 * that only the user can read.
 */
export class ClipboardHistory {
    /**
     * @param {Gio.Settings} settings - the extension settings
     * @param {string} path - where to keep the history across restarts
     * @param {function(): void} onChanged - called after every change
     */
    constructor(settings, path, onChanged) {
        this._settings = settings;
        this._path = path;
        this._onChanged = onChanged;
        this._items = [];
    }

    enable() {
        if (this._settings.get_boolean('persist-history'))
            this._load();
        this._settingsIds = [
            this._settings.connect('changed::history-size',
                () => this._changed()),
            this._settings.connect('changed::persist-history',
                () => this._onPersistChanged()),
        ];
        this._changed();
    }

    disable() {
        this._settingsIds.forEach(id => this._settings.disconnect(id));
        this._settingsIds = [];
    }

    /** @type {string[]} */
    get items() {
        return this._items;
    }

    /** @param {string} text - moves to the top if already there */
    add(text) {
        if (!text.trim())
            return;
        this._items = [text, ...this._items.filter(t => t !== text)];
        this._changed();
    }

    clear() {
        this._items = [];
        this._changed();
    }

    _changed() {
        this._items = this._items.slice(0, this._settings.get_int('history-size'));
        if (this._settings.get_boolean('persist-history'))
            this._save();
        this._onChanged();
    }

    _onPersistChanged() {
        if (this._settings.get_boolean('persist-history'))
            this._save();
        else
            GLib.unlink(this._path);
    }

    _load() {
        try {
            const [, bytes] = GLib.file_get_contents(this._path);
            const items = JSON.parse(new TextDecoder().decode(bytes));
            if (Array.isArray(items))
                this._items = items.filter(t => typeof t === 'string');
        } catch (e) {
            if (!(e instanceof GLib.Error &&
                  e.matches(GLib.FileError, GLib.FileError.NOENT)))
                console.warn(`Shift Copy: cannot load history: ${e.message}`);
        }
    }

    _save() {
        try {
            GLib.mkdir_with_parents(GLib.path_get_dirname(this._path), 0o700);
            GLib.file_set_contents_full(this._path,
                new TextEncoder().encode(JSON.stringify(this._items)),
                GLib.FileSetContentsFlags.CONSISTENT, 0o600);
        } catch (e) {
            console.warn(`Shift Copy: cannot save history: ${e.message}`);
        }
    }
}
