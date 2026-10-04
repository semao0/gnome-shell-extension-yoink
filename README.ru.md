# Yoink: копирование при выделении и история буфера обмена для GNOME Shell

> *yoink* (англ. сленг) — «цап!», быстро схватить. Выделили текст, и он уже ваш.

[![CI](https://github.com/semao0/gnome-shell-extension-yoink/actions/workflows/ci.yml/badge.svg)](https://github.com/semao0/gnome-shell-extension-yoink/actions/workflows/ci.yml)
[![GNOME Shell 49–51](https://img.shields.io/badge/GNOME_Shell-49%20%7C%2050%20%7C%2051-4A86CF?logo=gnome&logoColor=white)](#совместимость)
[![License: GPL-2.0-or-later](https://img.shields.io/badge/License-GPL--2.0--or--later-blue.svg)](LICENSE)

[English](README.md) | **Русский**

Расширение GNOME Shell, которое **копирует выделенный текст в буфер обмена**, пока зажата клавиша-модификатор.
Ещё оно ведёт **историю буфера обмена** и **чинит Ctrl+Shift+C и Ctrl+Shift+V в терминале на русской раскладке** и любой другой нелатинской.

Выделили текст с зажатым Shift — и вставляйте его через Ctrl+V где угодно.
Работает на Wayland в любых приложениях, в том числе в терминальных программах, которые перехватывают мышь: Claude Code, Codex CLI, vim, tmux, htop, mc.

## Возможности

- **Копирование при выделении с модификатором.** Зажмите Shift, Ctrl, Alt, Super или их сочетание — выделенный текст попадёт в обычный буфер обмена. Можно отключить модификаторы и копировать любое выделение, как в PuTTY.
- **Выделение в TUI-программах.** Терминал отдаёт мышь программам вроде Claude Code, Codex, vim и tmux. С зажатым Shift он всё равно выделяет текст, а расширение сразу его копирует.
- **История буфера обмена.** Последние 5–200 скопированных текстов доступны из верхней панели и по <kbd>Super</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>. Щелчок по записи копирует её снова.
- **Приватность.** История хранится в памяти. Сохранение в файл, доступный только вам, включается отдельно. Пароли из KeePassXC и других менеджеров паролей никогда не записываются.
- **Сочетания терминала на нелатинских раскладках.** В приложениях на GTK 4 сочетания вроде Ctrl+Shift+C и Ctrl+Shift+V не срабатывают на русской, украинской, греческой и других нелатинских раскладках ([GTK #5537](https://gitlab.gnome.org/GNOME/gtk/-/issues/5537)). Yoink исправляет это для терминала [Ptyxis](https://gitlab.gnome.org/chergert/ptyxis), который стоит по умолчанию в Fedora и Ubuntu.
- **Не мешает.** Значок в панели можно скрыть, история всё равно открывается по сочетанию клавиш.

## Установка

```sh
git clone https://github.com/semao0/gnome-shell-extension-yoink.git
cd gnome-shell-extension-yoink
make install
```

Затем выйдите из сеанса и войдите снова (на Wayland Shell нельзя перезапустить на лету) и включите расширение:

```sh
gnome-extensions enable yoink@semao0.github.io
```

Нужны `glib-compile-schemas`, `msgfmt` из gettext и `zip`, обычно они уже установлены. Готовый zip собирается на каждый коммит и лежит в артефактах [CI](https://github.com/semao0/gnome-shell-extension-yoink/actions/workflows/ci.yml).

## Использование

| Действие | Как |
| --- | --- |
| Скопировать текст | Зажать <kbd>Shift</kbd> и выделить мышью, вставить через <kbd>Ctrl</kbd>+<kbd>V</kbd> |
| Открыть историю | <kbd>Super</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> или значок в панели |
| Скопировать старую запись | Щёлкнуть по ней в истории |
| Настройки | Приложение «Расширения» или пункт **Настройки** в меню истории |

Полный список ключей `gsettings` и описание устройства — в [английском README](README.md#settings).

## Совместимость

- GNOME Shell 49, 50 и 51. Разрабатывается и проверяется на GNOME 50 с Wayland.
- Исправлению раскладок нужны Ptyxis и `xkbcomp` (пакет `x11-xkb-utils` или `xkbcomp`). Без них остальное работает.
- Выделение в TUI-программах с Shift поддерживают Ptyxis, GNOME Console, VS Code, Kitty, Alacritty и WezTerm.

## Если что-то не работает

- **Ничего не копируется.** Проверьте, что расширение включено (`gnome-extensions info yoink@semao0.github.io`), и что зажаты *все* модификаторы из настроек.
- **Super не работает как модификатор.** GNOME по умолчанию перетаскивает окна по Super и мыши. Выберите другой модификатор или выполните `gsettings set org.gnome.desktop.wm.preferences mouse-button-modifier '<Alt>'`.
- **Ctrl+Shift+V всё ещё не работает на раскладке.** Проверьте, что установлен `xkbcomp`, и посмотрите журнал: `journalctl --user -b -g 'Yoink'`.

## Лицензия

[GPL-2.0-or-later](LICENSE)
