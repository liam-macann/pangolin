import '@scalar/api-reference/style.css';
import './../theme.css';

import { type createApiReference } from '@scalar/api-reference';
import { renderApiReferenceToString } from '@scalar/server-side-rendering';
import { type Metadata } from 'next';
import { cacheLife } from 'next/cache';

import { getOpenApiDocument } from '@/api/hono';

import { ScalarHydrate } from './hydrate';

export const metadata: Metadata = {
	title: 'API Reference',
	description: 'Interactive reference documentation for the Invoicer API.',
};

const configuration = {
	withDefaultFonts: false,
	telemetry: false,
	hideClientButton: true,
	hideDarkModeToggle: true,
	// App handles dark mode outside of Scalar hydration
	forceDarkModeState: 'light',
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
} satisfies Parameters<typeof createApiReference>[1];

async function renderReference() {
	'use cache';
	cacheLife('max');
	const config = {
		...configuration,
		// Base URL must be provided to prevent hydration mismatch
		baseServerURL: process.env.VERCEL_PROJECT_PRODUCTION_URL
			? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
			: process.env.BETTER_AUTH_URL,
		content: await getOpenApiDocument(),
	};
	return { config, html: await renderApiReferenceToString(config) };
}

export default async function ApiReferencePage() {
	const { config, html } = await renderReference();

	return (
		<>
			{/* Server-rendered Scalar markup for instant first paint */}
			<div
				id='scalar-api-reference'
				className='light-mode'
				// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted server-rendered output from renderApiReferenceToString
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			<ScalarHydrate config={config} />
		</>
	);
}
