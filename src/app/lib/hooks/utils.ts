'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useIsAppleDevice(ssr: boolean = true) {
	const [modifier, setModifier] = useState(ssr);

	useEffect(() => {
		// macOS and iOS / iPadOS can both use keyboard shortcuts
		const isApple = /Mac|iPhone|iPad|iPod/i.test(
			// biome-ignore lint/suspicious/noExplicitAny: TS does not yet include types for non-baseline `userAgentData`
			(navigator as any).userAgentData?.platform || navigator.platform,
		);

		setModifier(isApple);
	}, []);

	return modifier;
}

type AsyncStatus = 'pending' | 'fulfilled' | 'rejected' | null;

interface UseAsyncStatusOptions {
	/** Delay before showing the loading state, so fast requests don't flash it. */
	loadingDelay?: number;
	/** How long the fulfilled/rejected state stays visible before resetting to null. */
	resetDelay?: number;
	onRejected?: (err: unknown) => void;
	onFulfilled?: (value: unknown) => void;
}

/** Tracks the status of a promise
 * @remarks Only the latest promise passed to track() will be followed
 */
export function useAsyncStatus({
	loadingDelay = 500,
	resetDelay = 1500,
	onRejected,
	onFulfilled,
}: UseAsyncStatusOptions = {}) {
	const [status, setStatus] = useState<AsyncStatus>(null);
	const timeout = useRef<NodeJS.Timeout>(null);

	/** Counter that reflects how many promises have been tracked */
	const trackedPromise = useRef(0);

	const track = useCallback(
		<T>(promise: Promise<T>) => {
			const promiseId = ++trackedPromise.current;
			const isCurrent = () => trackedPromise.current === promiseId;

			const clear = () => {
				if (!timeout.current) return;
				clearTimeout(timeout.current);
				timeout.current = null;
			};

			clear();

			// The loading delay should only occur if no status is visible
			if (status === null) {
				timeout.current = setTimeout(() => {
					// Check that tracked promise has not changed since timeout was scheduled
					if (isCurrent()) setStatus('pending');
				}, loadingDelay);
			} else setStatus('pending');

			const settle = (next: Exclude<AsyncStatus, 'pending' | null>, callback: () => void) => {
				clear();
				callback();
				setStatus(next);
				timeout.current = setTimeout(() => {
					if (!isCurrent()) return;
					timeout.current = null;
					setStatus(prev => (prev === next ? null : prev));
				}, resetDelay);
			};

			return promise.then(
				value => {
					if (!isCurrent()) return value;
					settle('fulfilled', () => onFulfilled?.(value));
					return value;
				},
				err => {
					if (!isCurrent()) throw err;
					settle('rejected', () => onRejected?.(err));

					throw err;
				},
			);
		},
		[status, loadingDelay, resetDelay, onRejected, onFulfilled],
	);

	return [status, track] as const;
}
