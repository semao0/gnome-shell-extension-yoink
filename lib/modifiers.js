// SPDX-License-Identifier: GPL-2.0-or-later
//
// Modifier names stored in the copy-modifiers setting. Kept free of
// Shell imports so the preferences window can use it too.

export const MODIFIERS = ['shift', 'ctrl', 'alt', 'super'];

const LABELS = {shift: 'Shift', ctrl: 'Ctrl', alt: 'Alt', super: 'Super'};

/**
 * @param {string[]} modifiers - names from the copy-modifiers setting
 * @returns {string} a label like "Ctrl+Shift", in a fixed order
 */
export function formatModifiers(modifiers) {
    return MODIFIERS
        .filter(m => modifiers.includes(m))
        .map(m => LABELS[m])
        .join('+');
}
