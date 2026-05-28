'use client';

import { useMediaQuery, usePrevious } from '@/lib/hooks';

export function DisableThemeTransitions() {
	const media = useMediaQuery('(prefers-color-scheme: dark)', { initializeWithValue: false });
	const previous = usePrevious(media);

	if (typeof document === 'undefined') return;

	if (media !== previous) {
		const style = document.createElement('style');
		style.textContent = '*,*::before,*::after{transition:none!important}';
		document.head.appendChild(style);

		// Force a synchronous style recalculation so the override is applied
		// before any transitions have a chance to start or continue
		window.getComputedStyle(document.documentElement).transition;

		requestAnimationFrame(() => {
			// Remove in next frame
			requestAnimationFrame(() => document.head.removeChild(style));
		});

		return;
	}

	return null;
}
