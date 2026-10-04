# SPDX-License-Identifier: GPL-2.0-or-later
UUID := yoink@semao0.github.io
DOMAIN := yoink
EXT_DIR := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
JS := extension.js prefs.js $(wildcard lib/*.js) $(wildcard tests/*.js)
PO := $(wildcard po/*.po)
MO := $(patsubst po/%.po,locale/%/LC_MESSAGES/$(DOMAIN).mo,$(PO))

.PHONY: all build pack install link test check pot clean

all: build

build: schemas/gschemas.compiled $(MO)

schemas/gschemas.compiled: schemas/*.gschema.xml
	glib-compile-schemas --strict schemas

locale/%/LC_MESSAGES/$(DOMAIN).mo: po/%.po
	@mkdir -p $(@D)
	if command -v msgfmt >/dev/null; then msgfmt --check -o $@ $<; \
	else pybabel compile -i $< -o $@; fi

# The zip to upload to extensions.gnome.org. Schemas are compiled on install.
pack: $(UUID).shell-extension.zip

$(UUID).shell-extension.zip: build metadata.json $(JS)
	rm -f $@
	zip -qr $@ metadata.json extension.js prefs.js lib schemas/*.gschema.xml locale LICENSE

install: pack
	gnome-extensions install --force $(UUID).shell-extension.zip
	@echo "Log out and back in, then: gnome-extensions enable $(UUID)"

# Run straight from this checkout while developing
link: build
	@if [ -e "$(EXT_DIR)" ] && [ ! -L "$(EXT_DIR)" ]; then \
		echo "$(EXT_DIR) exists and is not a symlink"; exit 1; fi
	ln -sfn "$(CURDIR)" "$(EXT_DIR)"

test: schemas/gschemas.compiled
	@for t in tests/*.test.js; do echo "== $$t"; gjs -m $$t || exit 1; done

check: test
	@for f in $(JS); do node --check $$f || exit 1; done
	glib-compile-schemas --strict --dry-run schemas
	@echo "All checks passed"

pot:
	xgettext --from-code=UTF-8 --language=JavaScript --add-comments \
		-o po/$(DOMAIN).pot extension.js prefs.js lib/*.js

clean:
	rm -rf schemas/gschemas.compiled locale *.shell-extension.zip
