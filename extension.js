// SPDX-License-Identifier: GPL-2.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Keyboard from 'resource:///org/gnome/shell/ui/status/keyboard.js';

import {ClipboardHistory} from './lib/history.js';
import {HistoryIndicator} from './lib/indicator.js';
import {PTYXIS_SCHEMA, PtyxisShortcuts} from './lib/ptyxisShortcuts.js';
import {SelectionWatcher} from './lib/selectionWatcher.js';

export default class ShiftCopyExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        this._history = new ClipboardHistory(this._settings,
            GLib.build_filenamev([GLib.get_user_data_dir(), this.uuid, 'history.json']),
            () => this._indicator?.updateHistory());
        this._history.enable();

        this._indicator = new HistoryIndicator(this._settings, this._history,
            () => this.openPreferences());
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._watcher = new SelectionWatcher(this._settings,
            text => this._history.add(text));
        this._watcher.enable();

        const ptyxisSchema = Gio.SettingsSchemaSource.get_default()
            .lookup(PTYXIS_SCHEMA, true);
        if (ptyxisSchema) {
            this._ptyxisShortcuts = new PtyxisShortcuts(this._settings,
                new Gio.Settings({settings_schema: ptyxisSchema}),
                Keyboard.getInputSourceManager());
            this._ptyxisSettingId = this._settings.connect('changed::fix-ptyxis-layouts',
                () => this._updatePtyxisShortcuts());
            this._updatePtyxisShortcuts();
        }

        Main.wm.addKeybinding('toggle-menu', this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._indicator.toggleMenu());
    }

    disable() {
        Main.wm.removeKeybinding('toggle-menu');
        if (this._ptyxisShortcuts) {
            this._settings.disconnect(this._ptyxisSettingId);
            this._ptyxisShortcuts.disable();
        }
        this._ptyxisShortcuts = null;
        this._watcher.disable();
        this._watcher = null;
        this._indicator.destroy();
        this._indicator = null;
        this._history.disable();
        this._history = null;
        this._settings = null;
    }

    _updatePtyxisShortcuts() {
        this._ptyxisShortcuts.disable();
        if (this._settings.get_boolean('fix-ptyxis-layouts'))
            this._ptyxisShortcuts.enable();
    }
}
