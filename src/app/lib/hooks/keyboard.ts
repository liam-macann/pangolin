'use client';

import { useEffect } from 'react';
import { type KeyBindingMap, type KeyBindingOptions, tinykeys } from 'tinykeys';

/**
 * Subscribes to key bindings.
 *
 * @example
 *
 * ```js
 * useKeyPress({
 *  'Shift+d': () => {
 *      alert("The 'Shift' and 'd' keys were pressed at the same time");
 *  },
 *  'a b c d': () => {
 *      alert("The keys 'a', 'b', 'c', and 'd' were pressed in order");
 *  },
 *  '$mod+d': () => {
 *      alert("Either 'Ctrl+d' or 'Cmd+d' were pressed, depending on the OS");
 *  },
 * });
 * ```
 *
 * @param handler - Associative array of key bindings and their handlers.
 */
export function useKeyPress(
	handler: KeyBindingMap,
	options: KeyPressOptions = { disabled: false },
) {
	useEffect(() => {
		const { target, disabled, ...opts } = options;

		if (disabled) return;
		const t = target ?? (typeof window !== 'undefined' ? window : null);
		if (!t) return;

		const unsubscribe = tinykeys(t, handler, opts);
		return () => unsubscribe();
	}, [handler, options]);
}

/**
 * An optional configuration object for `useKeyPress`
 *
 * @param target - Scopes the keybinding to a `HTMLElement`
 * @param event - Key presses will listen to this event (default: "keydown"). `"keydown" | "keyup"`
 * @param timeout - Keybinding sequences will wait this long between key presses before cancelling
 *   (default: 1000).
 */
interface KeyPressOptions extends KeyBindingOptions {
	target?: Window | HTMLElement;
	disabled?: boolean;
}
