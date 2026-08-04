'use client';

import { type ComponentProps, useLayoutEffect, useRef, useState } from 'react';
import 'scrollyfills';

/** Prevents a shrinking element height from affecting scroll position.
 *
 * If the element contents shrink, the parent height will remain unchanged.
 * The parent will invisibly contract after scrolling, when excess height exits the viewport. */
export function MaintainHeight({
	children,
	style,
	...rest
}: ComponentProps<'div'> & { style?: { minHeight?: never } }) {
	const ref = useRef<HTMLDivElement>(null);

	const [height, setHeight] = useState(0);

	useLayoutEffect(() => {
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
		<div ref={ref} {...rest} style={{ ...style, minHeight: height }}>
			{children}
		</div>
	);
}
