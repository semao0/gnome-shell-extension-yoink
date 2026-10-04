// SPDX-License-Identifier: GPL-2.0-or-later
import {PtyxisShortcuts} from '../lib/ptyxisShortcuts.js';
import {ROOT, assertEqual, finish, makeSettings, wait} from './helpers.js';

// Stands in for the Shell InputSourceManager
class FakeInputSources {
    constructor(xkbIds) {
        this.inputSources = Object.fromEntries(xkbIds.map((xkbId, i) => [i, {xkbId}]));
        this.currentSource = this.inputSources[0];
        this._handlers = new Map();
        this._nextId = 1;
    }

    connect(signal, handler) {
        this._handlers.set(this._nextId, handler);
        return this._nextId++;
    }

    disconnect(id) {
        this._handlers.delete(id);
    }

    switchTo(xkbId) {
        this.currentSource = {xkbId};
        this._handlers.forEach(handler => handler());
    }
}

const settings = makeSettings(`${ROOT}/schemas`, 'org.gnome.shell.extensions.shift-copy');
const ptyxis = makeSettings(`${ROOT}/tests/fixtures`, 'org.gnome.Ptyxis.Shortcuts');
const sources = new FakeInputSources(['us', 'ru', 'ua', 'gr', 'us+dvorak', 'de']);
const fix = new PtyxisShortcuts(settings, ptyxis, sources);

const shortcuts = () => ({
    copy: ptyxis.get_string('copy-clipboard'),
    paste: ptyxis.get_string('paste-clipboard'),
    newTab: ptyxis.get_string('new-tab'),
    zoom: ptyxis.get_string('zoom-in'),
});
const saved = () => Object.keys(settings.get_value('ptyxis-base-shortcuts').deepUnpack()).length;

async function switchTo(xkbId) {
    sources.switchTo(xkbId);
    await fix.update();
    await wait();
}

await fix.enable();
assertEqual(shortcuts(), {
    copy: '<ctrl><shift>c', paste: '<ctrl><shift>v', newTab: '<ctrl><shift>t', zoom: '<ctrl>plus',
}, 'us: untouched');
assertEqual(saved(), 0, 'us: nothing saved');

await switchTo('ru');
assertEqual(shortcuts(), {
    copy: '<ctrl><shift>Cyrillic_es', paste: '<ctrl><shift>Cyrillic_em',
    newTab: '<ctrl><shift>Cyrillic_ie', zoom: '<ctrl>plus',
}, 'ru: letters follow the physical keys');
assertEqual(saved(), 4, 'ru: originals saved');

ptyxis.set_string('new-tab', '<ctrl><shift>n');
await wait();
await fix.update();
assertEqual(ptyxis.get_string('new-tab'), '<ctrl><shift>Cyrillic_te', 'ru: a user edit is translated too');

await switchTo('ua');
assertEqual(shortcuts().paste, '<ctrl><shift>Cyrillic_em', 'ua: paste on the V key');

await switchTo('gr');
assertEqual([shortcuts().copy, shortcuts().paste], ['<ctrl><shift>Greek_psi', '<ctrl><shift>Greek_omega'],
    'gr: Greek letters');

await switchTo('us+dvorak');
assertEqual(shortcuts(), {
    copy: '<ctrl><shift>c', paste: '<ctrl><shift>v', newTab: '<ctrl><shift>n', zoom: '<ctrl>plus',
}, 'dvorak: Latin layout gets the originals, including the user edit');
assertEqual(saved(), 0, 'dvorak: nothing saved');

await switchTo('de');
assertEqual(shortcuts().paste, '<ctrl><shift>v', 'de: untouched');

await switchTo('ru');
fix.disable();
await wait();
assertEqual(shortcuts().paste, '<ctrl><shift>v', 'disable restores the originals');
assertEqual(saved(), 0, 'disable clears the saved copy');

finish();
