'use client';

import { type JSX, useEffect, useRef, useState } from 'react';
import 'scrollyfills';

/** Prevents a shrinking element height from affecting scroll position.
 *
 * If the element contents shrink, the parent height will remain unchanged.
 * The parent will invisibly contract after scrolling, when excess height exits the viewport. */
export function MaintainHeight({ children }: { children: JSX.Element }) {
	const ref = useRef<HTMLDivElement>(null);

	const [height, setHeight] = useState(0);

	useEffect(() => {
		const callback = () => {
			if (!ref.current) return;

			const rect = ref.current.getBoundingClientRect();
			const visibleHeight = Math.min(window.innerHeight - rect.top, rect.height);

			setHeight(visibleHeight);
		};

		// Set initial value on page load
		callback();

		// Polyfilled event
		window.addEventListener('scrollend', callback);
		window.addEventListener('resize', callback);

		return () => {
			removeEventListener('scrollend', callback);
			removeEventListener('resize', callback);
		};
	}, []);

	return (
		<div ref={ref} style={{ minHeight: height }}>
			{children}
		</div>
	);
}
