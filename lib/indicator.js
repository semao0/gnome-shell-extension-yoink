// SPDX-License-Identifier: GPL-2.0-or-later
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {formatModifiers} from './modifiers.js';

const LABEL_LENGTH = 60;

/**
 * @param {string} text - a clipboard entry
 * @returns {string} its first line or so, with whitespace squeezed
 */
function makeLabel(text) {
    const chars = Array.from(
        text.slice(0, LABEL_LENGTH * 4).trim().replace(/\s+/g, ' '));
    return chars.length > LABEL_LENGTH
        ? `${chars.slice(0, LABEL_LENGTH).join('')}…`
        : chars.join('');
}

/**
 * The panel icon with the clipboard history menu. With show-indicator
 * off it stays hidden and shows only while the menu is open.
 */
export const HistoryIndicator = GObject.registerClass(
class HistoryIndicator extends PanelMenu.Button {
    /**
     * @param {Gio.Settings} settings - the extension settings
     * @param {ClipboardHistory} history - entries to list
     * @param {function(): void} openPreferences - opens the settings window
     */
    _init(settings, history, openPreferences) {
        super._init(0.0, 'Shift Copy', false);
        this._settings = settings;
        this._history = history;
        this._openId = 0;

        this.add_child(new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon',
        }));
        this._createMenu(openPreferences);

        this.menu.connect('open-state-changed', () => this._updateVisibility());
        this._settings.connectObject(
            'changed::show-indicator', () => this._updateVisibility(),
            'changed::copy-on-select', () => this._updateSwitch(),
            'changed::copy-modifiers', () => this._updateSwitch(),
            this);
        this.connect('destroy', () => {
            if (this._openId)
                GLib.source_remove(this._openId);
            this._openId = 0;
        });

        this._updateVisibility();
        this._updateSwitch();
        this.updateHistory();
    }

    toggleMenu() {
        if (this.visible) {
            this.menu.toggle();
            return;
        }
        // Open the menu once the icon has a place in the panel, so the
        // menu pops up under it
        this.visible = true;
        if (this._openId)
            GLib.source_remove(this._openId);
        this._openId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            this._openId = 0;
            this.menu.open();
            return GLib.SOURCE_REMOVE;
        });
    }

    updateHistory() {
        this._historySection.removeAll();
        if (!this._history.items.length) {
            this._historySection.addMenuItem(
                new PopupMenu.PopupMenuItem(_('History is empty'), {reactive: false}));
            return;
        }
        for (const text of this._history.items) {
            const item = new PopupMenu.PopupMenuItem(makeLabel(text));
            // The section lives in a scroll view outside the menu tree,
            // so activating an item does not close the menu by itself
            item.connect('activate', () => {
                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
                this.menu.close();
            });
            this._historySection.addMenuItem(item);
        }
    }

    _createMenu(openPreferences) {
        this._historySection = new PopupMenu.PopupMenuSection();
        const scrollView = new St.ScrollView({
            child: this._historySection.actor,
            style: 'max-height: 30em;',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
        });
        const scrollSection = new PopupMenu.PopupMenuSection();
        scrollSection.actor.add_child(scrollView);
        this.menu.addMenuItem(scrollSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._copySwitch = new PopupMenu.PopupSwitchMenuItem('', false);
        this._copySwitch.connect('toggled', (item, state) =>
            this._settings.set_boolean('copy-on-select', state));
        this.menu.addMenuItem(this._copySwitch);
        this.menu.addAction(_('Clear History'), () => this._history.clear());
        this.menu.addAction(_('Settings'), openPreferences);
    }

    _updateSwitch() {
        const modifiers = formatModifiers(this._settings.get_strv('copy-modifiers'));
        this._copySwitch.label.text = modifiers
            ? _('Copy on select with %s').replace('%s', modifiers)
            : _('Copy on select');
        this._copySwitch.setToggleState(this._settings.get_boolean('copy-on-select'));
    }

    _updateVisibility() {
        this.visible = this._settings.get_boolean('show-indicator') || this.menu.isOpen;
    }
});
