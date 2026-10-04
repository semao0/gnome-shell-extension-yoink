# Yoink: copy on select and clipboard history for GNOME Shell

> *yoink* (slang): to grab something quickly. Select text, and it's yours.

[![CI](https://github.com/semao0/gnome-shell-extension-yoink/actions/workflows/ci.yml/badge.svg)](https://github.com/semao0/gnome-shell-extension-yoink/actions/workflows/ci.yml)
[![GNOME Shell 49–51](https://img.shields.io/badge/GNOME_Shell-49%20%7C%2050%20%7C%2051-4A86CF?logo=gnome&logoColor=white)](#compatibility)
[![Wayland](https://img.shields.io/badge/Wayland-ready-success)](#how-it-works)
[![License: GPL-2.0-or-later](https://img.shields.io/badge/License-GPL--2.0--or--later-blue.svg)](LICENSE)

**English** | [Русский](README.ru.md)

A GNOME Shell extension that **copies selected text to the clipboard** while you hold a modifier key.
It also keeps a **clipboard history** and makes **terminal shortcuts like Ctrl+Shift+C and Ctrl+Shift+V work on any keyboard layout**.

Select with Shift held, then press Ctrl+V anywhere.
It works on Wayland in any app, and also in terminal programs that grab the mouse: Claude Code, Codex CLI, vim, tmux, htop, mc.

## Features

- **Copy on select with a modifier.** Hold Shift, Ctrl, Alt, Super or any combination while you select, and the text goes to the regular clipboard. You can also turn modifiers off and copy every selection, like PuTTY or the X11 primary selection, but in the clipboard you paste with Ctrl+V.
- **Selection inside TUI apps.** Terminals hand the mouse to programs like Claude Code, Codex, vim or tmux. Holding Shift makes the terminal select text anyway, and the extension copies it in the same gesture.
- **Clipboard history.** The last 5–200 copied texts sit in the top panel and open with <kbd>Super</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>. Click an entry to copy it again.
- **Private by default.** History lives in memory. You can opt in to saving it to a file only you can read. Passwords copied from KeePassXC and other password managers are never recorded.
- **Terminal shortcuts on non-Latin layouts.** In GTK 4 apps, shortcuts like Ctrl+Shift+C and Ctrl+Shift+V stop working when a Russian, Ukrainian, Greek or other non-Latin layout is active ([GTK #5537](https://gitlab.gnome.org/GNOME/gtk/-/issues/5537)). Yoink fixes this for the [Ptyxis](https://gitlab.gnome.org/chergert/ptyxis) terminal, the default in Fedora and Ubuntu.
- **Out of your way.** The panel icon can be hidden. The history shortcut still opens the menu.

## Installation

### From source

```sh
git clone https://github.com/semao0/gnome-shell-extension-yoink.git
cd gnome-shell-extension-yoink
make install
```

Then log out and back in (Wayland can't reload the Shell in place) and enable the extension:

```sh
gnome-extensions enable yoink@semao0.github.io
```

You need `glib-compile-schemas`, `msgfmt` from gettext, and `zip`. They are usually installed already.

### From a CI build

Every push builds an installable zip. Download it from the latest [CI run](https://github.com/semao0/gnome-shell-extension-yoink/actions/workflows/ci.yml), then:

```sh
gnome-extensions install --force yoink@semao0.github.io.shell-extension.zip
```

## Usage

| Action | How |
| --- | --- |
| Copy text | Hold <kbd>Shift</kbd> and select with the mouse, then paste with <kbd>Ctrl</kbd>+<kbd>V</kbd> |
| Open the history | <kbd>Super</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> or the panel icon |
| Copy an older entry | Click it in the history |
| Change the settings | The Extensions app, or **Settings** in the history menu |

## Settings

Everything is in the preferences window. You can also use `gsettings`:

```sh
gsettings --schemadir ~/.local/share/gnome-shell/extensions/yoink@semao0.github.io/schemas \
  set org.gnome.shell.extensions.yoink copy-modifiers "['ctrl', 'shift']"
```

| Key | Default | Meaning |
| --- | --- | --- |
| `copy-on-select` | `true` | Copy selected text to the clipboard |
| `copy-modifiers` | `['shift']` | Keys that must all be held while selecting: `shift`, `ctrl`, `alt`, `super`. An empty list copies every selection |
| `history-size` | `30` | How many entries to keep (5–200) |
| `persist-history` | `false` | Keep the history across restarts in `~/.local/share/yoink@semao0.github.io/history.json` (mode 600) |
| `toggle-menu` | `['<Super><Shift>v']` | Shortcut that opens the history |
| `show-indicator` | `true` | Show the icon in the top panel |
| `fix-ptyxis-layouts` | `true` | Keep Ptyxis shortcuts working on non-Latin layouts |

## How it works

- **Copy on select.** Every app that supports selection publishes it as the *primary selection*, the one you paste with the middle mouse button. The extension watches it through Mutter's `Meta.Selection`. When the selection settles, it checks which modifiers are held and copies the text to the clipboard. Selections that aren't text, such as files or images, are ignored.
- **History.** It records every text that reaches the clipboard, through this extension or through Ctrl+C. Entries with the `x-kde-passwordManagerHint` mime type, which password managers set, are skipped.
- **Layouts.** GTK 4 compares shortcuts against the keysym the key produces. On a Russian layout, the V key produces `Cyrillic_em`, so `<Ctrl><Shift>v` never fires. When you switch to a non-Latin layout, the extension finds, with `xkbcomp`, which symbol each letter's physical key produces in that layout, and rewrites Ptyxis shortcuts to use it. On a Latin layout it puts your original shortcuts back. Ptyxis shortcuts you edit meanwhile are kept. Dvorak, Colemak, AZERTY and other Latin layouts are left alone, because GTK handles those itself.

## Compatibility

- GNOME Shell 49, 50 and 51. Developed and tested on GNOME 50 with Wayland.
- The layout fix needs Ptyxis and `xkbcomp` (package `x11-xkb-utils` or `xkbcomp`). Without them, the rest of the extension still works.
- Selection inside TUI apps depends on the terminal. Ptyxis, GNOME Console, VS Code, Kitty, Alacritty and WezTerm all bypass mouse capture with Shift.

## Troubleshooting

- **Nothing is copied.** Make sure the extension is enabled (`gnome-extensions info yoink@semao0.github.io`) and that you hold *every* modifier listed in the settings.
- **Super doesn't work as a modifier.** GNOME moves windows with Super and drag. Change it with `gsettings set org.gnome.desktop.wm.preferences mouse-button-modifier '<Alt>'`, or pick another modifier.
- **Ctrl+Shift+V still fails on my layout.** Check that `xkbcomp` is installed, then look at the Shell log: `journalctl --user -b -g 'Yoink'`.
- **Logs.** `journalctl --user -b /usr/bin/gnome-shell | grep -i 'yoink'`

## Development

```sh
make link     # symlink this checkout into ~/.local/share/gnome-shell/extensions
make check    # syntax, schemas and unit tests (gjs)
make pack     # build the zip for extensions.gnome.org
make pot      # refresh the translation template
```

Code that touches the Shell lives in `extension.js` and `lib/indicator.js`. The logic in `lib/history.js` and `lib/ptyxisShortcuts.js` runs under plain `gjs` and is covered by `tests/`.

Translations are welcome. Copy `po/yoink.pot` (from `make pot`) to `po/<lang>.po` and open a pull request.

## License

[GPL-2.0-or-later](LICENSE)
