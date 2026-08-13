'use client';

import { type SetStateAction, useRef, useState } from 'react';

/**
 * Wraps useState() to allow both controlled and uncontrolled components to access a single variable
 * @returns [value, setValue]
 */
export function useControllableState<T>({
	value,
	defaultValue,
	onChange,
}: {
	/** The controlled value. If provided, this will override internal value */
	value?: T;
	/* The initial value if not controlled */
	defaultValue: T;
	/** A callback fired when the value changes */
	onChange?: (value: T) => void;
}) {
	const [internalValue, setInternalValue] = useState(defaultValue);

	const isControlled = value !== undefined;
	const wasControlled = useRef(isControlled);

	if (wasControlled.current !== isControlled) {
		console.error(
			`useControllableState() is changing from ${wasControlled.current ? 'controlled' : 'uncontrolled'} to ${isControlled ? 'controlled' : 'uncontrolled'}. ` +
				`Components should not switch between controlled and uncontrolled state.`,
		);
		wasControlled.current = isControlled;
	}

	const current = isControlled ? value : internalValue;

	const setValue = (updater: SetStateAction<T>) => {
		const next = typeof updater === 'function' ? (updater as (previous: T) => T)(current) : updater;

		if (!isControlled) setInternalValue(next);
		onChange?.(next);
	};

	return [current, setValue] as const;
}
