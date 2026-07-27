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

/** Tracks the status of promise */
export function useAsyncStatus({
	loadingDelay = 500,
	resetDelay = 1500,
	onRejected,
	onFulfilled,
}: UseAsyncStatusOptions = {}) {
	const [status, setStatus] = useState<AsyncStatus>(null);
	const timeout = useRef<NodeJS.Timeout>(null);

	const track = useCallback(
		<T>(promise: Promise<T>) => {
			const clear = () => {
				if (timeout.current) clearTimeout(timeout.current);
			};

			clear();

			timeout.current = setTimeout(
				() => setStatus(prev => (prev === null ? 'pending' : prev)),
				loadingDelay,
			);

			return promise.then(
				value => {
					clear();
					onFulfilled?.(value);
					setStatus('fulfilled');
					timeout.current = setTimeout(
						() =>
							setStatus(prev => {
								clear();
								return prev === 'fulfilled' ? null : prev;
							}),
						resetDelay,
					);
					return value;
				},
				err => {
					clear();
					onRejected?.(err);
					setStatus('rejected');
					timeout.current = setTimeout(
						() =>
							setStatus(prev => {
								clear();
								return prev === 'rejected' ? null : prev;
							}),
						resetDelay,
					);

					throw err;
				},
			);
		},
		[loadingDelay, resetDelay, onRejected, onFulfilled],
	);

	return [status, track] as const;
}
