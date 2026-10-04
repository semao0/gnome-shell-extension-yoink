// SPDX-License-Identifier: GPL-2.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.File.prototype, 'load_contents_async');
Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async',
    'replace_contents_finish');
Gio._promisify(Gio.File.prototype, 'delete_async');

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
        this._file = Gio.File.new_for_path(path);
        this._onChanged = onChanged;
        this._items = [];
        // File operations run one after another in this chain
        this._io = Promise.resolve();
        this._syncQueued = false;
    }

    /** @returns {Promise<void>} resolves once a saved history is loaded */
    enable() {
        this._settingsIds = [
            this._settings.connect('changed::history-size',
                () => this._changed()),
            this._settings.connect('changed::persist-history',
                () => this._syncFile()),
        ];
        // Load before anything is written over the saved file
        if (this._settings.get_boolean('persist-history'))
            this._io = this._io.then(() => this._load());
        this._changed();
        return this._io;
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

    /** @returns {Promise<void>} resolves once the file matches the history */
    flush() {
        return this._io;
    }

    _changed() {
        this._items = this._items.slice(0, this._settings.get_int('history-size'));
        if (this._settings.get_boolean('persist-history'))
            this._syncFile();
        this._onChanged();
    }

    async _load() {
        let items;
        try {
            const [bytes] = await this._file.load_contents_async(null);
            items = JSON.parse(new TextDecoder().decode(bytes));
        } catch (e) {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                console.warn(`Yoink: cannot load history: ${e.message}`);
            return;
        }
        if (!Array.isArray(items))
            return;
        // Keep anything copied while the file was loading on top
        const loaded = items.filter(t => typeof t === 'string' && !this._items.includes(t));
        this._items = [...this._items, ...loaded];
        this._changed();
    }

    // Writes the history, or deletes the file when persist-history is off.
    // Calls made while a write is waiting share it.
    _syncFile() {
        if (this._syncQueued)
            return;
        this._syncQueued = true;
        this._io = this._io.then(async () => {
            this._syncQueued = false;
            try {
                if (this._settings.get_boolean('persist-history'))
                    await this._write();
                else
                    await this._file.delete_async(GLib.PRIORITY_DEFAULT, null);
            } catch (e) {
                if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                    console.warn(`Yoink: cannot save history: ${e.message}`);
            }
        });
    }

    async _write() {
        GLib.mkdir_with_parents(this._file.get_parent().get_path(), 0o700);
        const bytes = new GLib.Bytes(new TextEncoder().encode(JSON.stringify(this._items)));
        // PRIVATE: readable only by the user
        await this._file.replace_contents_bytes_async(bytes, null, false,
            Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    }
}
