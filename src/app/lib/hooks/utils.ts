'use client';

import { useEffect, useState } from 'react';

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
