import '@scalar/api-reference-react/style.css';
import './../theme.css';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import { type Metadata } from 'next';

import { getOpenApiDocument } from '@/api/hono';

export const metadata: Metadata = {
	title: 'API Reference',
	description: 'Interactive reference documentation for the Invoicer API.',
};

// @scalar/api-reference-react pulls in the `web-worker` polyfill, which
// runs worker_threads.isMainThread-dependent code at import time.
//
// That crashes inside Next.js instant-navigation probe worker (not real SSR, which renders this fine)
export const instant = false;

const content = await getOpenApiDocument();
export default async function ApiReferencePage() {
	return (
		<ApiReferenceReact
			configuration={{
				content,
				withDefaultFonts: false,
				telemetry: false,
				hideClientButton: true,
				hideDarkModeToggle: true,
				showDeveloperTools: 'never',
				mcp: { disabled: true },
				agent: { disabled: true },
				documentDownloadType: 'none',
				modelsSectionLabel: 'Schemas',
				showSidebar: false,
				pathRouting: { basePath: '/docs/api' },
				defaultOpenAllTags: true,
				hiddenClients: [
					'c',
					'r',
					// 'go',
					'rust',
					'node',
					'http',
					'clojure',
					'csharp',
					'dart',
					'fsharp',
					'java',
					'kotlin',
					'objc',
					'ocaml',
					'php',
					'powershell',
					// 'python',
					'ruby',
					// 'shell',
					// 'swift',
					'js/jquery',
				],
			}}
		/>
	);
}
