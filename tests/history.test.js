// SPDX-License-Identifier: GPL-2.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ClipboardHistory} from '../lib/history.js';
import {ROOT, assertEqual, finish, makeSettings, makeTempDir} from './helpers.js';

const settings = makeSettings(`${ROOT}/schemas`, 'org.gnome.shell.extensions.yoink');
const path = `${makeTempDir()}/data/history.json`;
let changes = 0;
const history = new ClipboardHistory(settings, path, () => changes++);
history.enable();

history.add('one');
history.add('two');
history.add('one');
history.add('  \n');
assertEqual(history.items, ['one', 'two'], 'newest first, duplicates move up, blanks skipped');
assertEqual(GLib.file_test(path, GLib.FileTest.EXISTS), false, 'nothing written without persist-history');

settings.set_int('history-size', 5);
for (let i = 0; i < 10; i++)
    history.add(`item ${i}`);
assertEqual(history.items.length, 5, 'trimmed to history-size');

settings.set_boolean('persist-history', true);
assertEqual(GLib.file_test(path, GLib.FileTest.EXISTS), true, 'saved once persist-history is on');
assertEqual(fileMode(path), 0o600, 'history file readable only by the owner');

const reloaded = new ClipboardHistory(settings, path, () => {});
reloaded.enable();
assertEqual(reloaded.items, history.items, 'reloaded after a restart');
reloaded.disable();

history.clear();
assertEqual(history.items, [], 'cleared');

settings.set_boolean('persist-history', false);
assertEqual(GLib.file_test(path, GLib.FileTest.EXISTS), false, 'file removed when persist-history is off');

history.disable();
assertEqual(changes > 0, true, 'onChanged called');
finish();

function fileMode(file) {
    const info = Gio.File.new_for_path(file).query_info('unix::mode',
        Gio.FileQueryInfoFlags.NONE, null);
    return info.get_attribute_uint32('unix::mode') & 0o777;
}
