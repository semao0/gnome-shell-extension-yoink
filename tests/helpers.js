// SPDX-License-Identifier: GPL-2.0-or-later
// A tiny harness for running the Shell-independent modules under plain gjs.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const ROOT = GLib.path_get_dirname(GLib.path_get_dirname(
    GLib.filename_from_uri(import.meta.url)[0]));

let failures = 0;

export function assertEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        print(`ok   ${message}`);
    } else {
        failures++;
        printerr(`FAIL ${message}\n     expected ${e}\n     got      ${a}`);
    }
}

export function finish() {
    if (failures)
        throw new Error(`${failures} check(s) failed`);
}

export function makeTempDir() {
    return GLib.dir_make_tmp('yoink-test-XXXXXX');
}

/**
 * Compiles the schemas in a source directory into a temporary one and
 * returns memory-backed settings for one of them.
 */
export function makeSettings(sourceDir, schemaId) {
    const target = makeTempDir();
    const proc = Gio.Subprocess.new(['glib-compile-schemas', '--strict',
        `--targetdir=${target}`, sourceDir], Gio.SubprocessFlags.NONE);
    proc.wait_check(null);
    const source = Gio.SettingsSchemaSource.new_from_directory(target, null, false);
    return new Gio.Settings({
        settings_schema: source.lookup(schemaId, false),
        backend: Gio.memory_settings_backend_new(),
    });
}

/** Lets pending signals and idle callbacks run. */
export function wait(ms = 50) {
    return new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
}
