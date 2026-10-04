// SPDX-License-Identifier: GPL-2.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {MODIFIERS, formatModifiers} from './lib/modifiers.js';

export default class ShiftCopyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        page.add(this._createCopyGroup(settings));
        page.add(this._createModifiersGroup(settings));
        page.add(this._createHistoryGroup(settings));
        page.add(this._createLayoutGroup(settings));
        window.add(page);
        window._settings = settings;
    }

    _createCopyGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Copy on Select'),
            description: _('Selected text goes straight to the clipboard, ready for Ctrl+V.'),
        });
        const row = new Adw.SwitchRow({title: _('Enabled')});
        settings.bind('copy-on-select', row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
        return group;
    }

    _createModifiersGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Modifiers'),
            description: _('Copy only while all checked keys are held during the selection. ' +
                'Check none to copy every selection.'),
        });
        const subtitles = {
            shift: _('In terminals it also selects text inside apps that capture the mouse, ' +
                'such as Claude Code, Codex or vim'),
            super: _('GNOME moves windows with Super and the mouse by default'),
        };
        for (const id of MODIFIERS) {
            const row = new Adw.SwitchRow({
                title: formatModifiers([id]),
                subtitle: subtitles[id] ?? '',
            });
            const sync = () => {
                row.active = settings.get_strv('copy-modifiers').includes(id);
            };
            sync();
            row.connect('notify::active', () => {
                const current = settings.get_strv('copy-modifiers');
                if (row.active === current.includes(id))
                    return;
                settings.set_strv('copy-modifiers', row.active
                    ? [...current, id]
                    : current.filter(m => m !== id));
            });
            settings.connect('changed::copy-modifiers', sync);
            settings.bind('copy-on-select', row, 'sensitive', Gio.SettingsBindFlags.GET);
            group.add(row);
        }
        return group;
    }

    _createHistoryGroup(settings) {
        const group = new Adw.PreferencesGroup({title: _('History')});

        const sizeRow = Adw.SpinRow.new_with_range(5, 200, 1);
        sizeRow.title = _('History size');
        settings.bind('history-size', sizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(sizeRow);

        const path = GLib.build_filenamev(['~/.local/share', this.uuid, 'history.json']);
        const persistRow = new Adw.SwitchRow({
            title: _('Keep across restarts'),
            subtitle: GLib.markup_escape_text(
                _('Stored in %s, readable only by you. Passwords from KeePassXC are never saved.')
                    .replace('%s', path), -1),
        });
        settings.bind('persist-history', persistRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(persistRow);

        const shortcutRow = new Adw.ActionRow({
            title: _('Open history'),
            subtitle: _('Change it with gsettings, key toggle-menu'),
        });
        shortcutRow.add_suffix(new Gtk.ShortcutLabel({
            accelerator: settings.get_strv('toggle-menu')[0] ?? '',
            valign: Gtk.Align.CENTER,
        }));
        group.add(shortcutRow);

        const indicatorRow = new Adw.SwitchRow({
            title: _('Panel icon'),
            subtitle: _('When off, the icon shows only while the history is open. ' +
                'These settings then open from the Extensions app.'),
        });
        settings.bind('show-indicator', indicatorRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(indicatorRow);

        return group;
    }

    _createLayoutGroup(settings) {
        const group = new Adw.PreferencesGroup({title: _('Keyboard Layouts')});
        const row = new Adw.SwitchRow({
            title: _('Ptyxis shortcuts on any layout'),
            subtitle: _('Ctrl+Shift+C, Ctrl+Shift+V and the rest keep working on Cyrillic, ' +
                'Greek and other non-Latin layouts'),
        });
        settings.bind('fix-ptyxis-layouts', row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
        return group;
    }
}
