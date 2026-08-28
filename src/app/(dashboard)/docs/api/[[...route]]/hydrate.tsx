'use client';

import { type createApiReference } from '@scalar/api-reference';
import Script from 'next/script';
import { useEffect, useRef } from 'react';

type ScalarConfig = Parameters<typeof createApiReference>[1];
type ScalarInstance = ReturnType<typeof createApiReference>;

declare global {
	interface Window {
		Scalar?: { createApiReference: typeof createApiReference };
	}
}

/**
 * Mounts the interactive Scalar reference into `#scalar-api-reference`
 *
 * @remarks The container already holds a server-rendered copy for instant first paint; we clear it,
 * and let Scalar mount fresh rather than hydrate (Scalar SSR output diverges from its client render)
 */
export function ScalarHydrate({ config }: { config: ScalarConfig }) {
	const instance = useRef<ScalarInstance | null>(null);

	const mount = () => {
		const container = document.getElementById('scalar-api-reference');
		if (!container || !window.Scalar) return;

		instance.current?.destroy();
		container.replaceChildren();
		instance.current = window.Scalar.createApiReference(container, config);
	};

	useEffect(() => () => instance.current?.destroy(), []);

	// This bundle is huge, and so served via route handler rather than in RSC payload
	return <Script src='/docs/api/scalar.js' strategy='afterInteractive' onReady={mount} />;
}
