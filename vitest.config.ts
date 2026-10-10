/// <reference types="vitest/browser" />

import { globSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';
import { type BrowserInstanceOption } from 'vitest/node';

import { dragWithAnimation } from './src/test/commands.js';
import { SchemathesisSequencer } from './src/test/schemathesis/sequencer.js';

const require = createRequire(import.meta.url);
const libAddressRoot = path.dirname(require.resolve('lib-address/package.json'));
const nextReactRoot = path.dirname(require.resolve('next/dist/compiled/react/package.json'));
const nextReactDomRoot = path.dirname(require.resolve('next/dist/compiled/react-dom/package.json'));

const args = process.argv.slice(2);

const isCoverage = args.includes('--coverage');
const isRun = args.includes('run') || args.includes('--run');
const isWatch = configDefaults.watch && !isRun;
const isTypecheck = args.includes('--typecheck');

const browserTestPatterns = ['src/**/*.test.tsx', 'src/**/*.browser.test.ts'];

/** Shards test files across browser instances */
const browserInstances = (
	partial: Partial<BrowserInstanceOption> & Pick<BrowserInstanceOption, 'browser'>,
) => {
	// CI runner can't handle parallel browser instances (WebKit crashes/stalls)
	const BROWSER_INSTANCES = process.env.CI ? 1 : 3;

	const shards = Array.from({ length: BROWSER_INSTANCES }, (_, instance) =>
		globSync(browserTestPatterns)
			.sort()
			.filter((_, fileIndex) => fileIndex % BROWSER_INSTANCES === instance),
	).filter(files => files.length > 0);

	return shards.map(
		(files, index): BrowserInstanceOption => ({
			name: `browser (${shards.length > 1 ? `${partial.browser} ${index + 1}/${shards.length}` : partial.browser})`,
			fileParallelism: false,
			include: files,
			...partial,
		}),
	);
};

export default defineConfig({
	optimizeDeps: {
		entries: browserTestPatterns,
		include: [
			'react',
			'react/jsx-dev-runtime',
			'react-dom',
			'react-dom/client',
			'vitest-browser-react/pure',
			'es-toolkit/object',
			'next/navigation',
			'next/cache',
			'next/server',
			'hono/client',
			'server-only',
			'client-only',
			'@uidotdev/usehooks',
			'usehooks-ts',
			'@base-ui/react',
			'@phosphor-icons/react',
			'class-variance-authority',
			'clsx',
			'cmdk',
			'motion/react',
			'react-is',
			'tailwind-merge',
			'date-fns',
		],
	},
	resolve: {
		tsconfigPaths: true,
		alias: {
			// lib-address ESM node entry calls CJS require() to load metadata.
			// This causes issues under Vitest native ESM, so server tests use its CJS entry.
			'lib-address$': path.join(libAddressRoot, 'dist/entry-node.cjs'),
			// Subpath imports
			'lib-address': libAddressRoot,
		},
	},
	test: {
		watch: isWatch, // Inherit watch flag in projects
		silent: 'passed-only',
		setupFiles: ['./src/test/setup.ts'],
		clearMocks: true,
		// Orders the two `*.fuzz.ts` files (generate → replay); a no-op for every other project
		sequence: { sequencer: SchemathesisSequencer },
		coverage: {
			include: [
				...(configDefaults.coverage.include ?? []),
				'src/app/**/*.ts',
				'src/app/**/*.tsx',

				'src/app/api/schemathesis.*.fuzz.ts',
				'src/app/**/*.test.ts',
				'src/app/**/*.test.tsx',

				'src/db/index.ts',
				'src/db/schema/data/_helpers.ts',

				'src/components/**/*.tsx',
			],
			exclude: [
				...(configDefaults.coverage.exclude ?? []),
				'src/app/**/*.test-d.ts',
				'src/app/lib/auth.ts',
				'src/styles/fonts.ts',
				'src/styles/color-schemes.ts',
				'src/components/ui/*.tsx',
			],
		},
		projects: [
			{
				extends: true,
				test: {
					name: { label: 'server', color: 'green' },
					environment: 'node',
					isolate: false,
					// Each worker will have to spin up a new DB instance, which adds considerable overhead.
					// Increased parallelism may make sense with a larger volume of tests.
					maxWorkers: 2,
					sequence: { groupOrder: 2 },
					include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
					exclude: ['src/app/api/**/*.test.ts'],
					typecheck: {
						enabled: isTypecheck,
						include: ['src/**/*.test-d.ts'],
						exclude: [...configDefaults.typecheck.exclude, 'src/app/api/**/*.test-d.ts'],
					},
					setupFiles: ['./src/test/setup-server.ts'],
				},
			},
			{
				extends: true,
				test: {
					name: { label: 'API', color: 'magenta' },
					environment: 'node',
					isolate: false,
					// Each worker will have to spin up a new DB instance, which adds considerable overhead.
					// Increased parallelism may make sense with a larger volume of tests.
					maxWorkers: 2,
					sequence: { groupOrder: 1 },
					include: ['src/app/api/**/*.test.ts'],
					typecheck: { enabled: isTypecheck, include: ['src/app/api/**/*.test-d.ts'] },
					setupFiles: ['./src/test/setup-server.ts'],
				},
			},
			{
				// Schemathesis API fuzzing — opt in with `--project fuzz` (needs `uvx` on PATH);
				// the default scripts skip it with `--project '!fuzz'`.
				extends: true,
				test: {
					name: { label: 'fuzz', color: 'cyan' },
					environment: 'node',
					isolate: false,
					include: ['src/app/api/schemathesis.*.fuzz.ts'],
					setupFiles: ['./src/test/setup-server.ts'],
				},
			},
			{
				extends: true,
				resolve: {
					alias: {
						'lib-address$': path.join(libAddressRoot, 'dist/entry-browser.cjs'),
						'lib-address': libAddressRoot,
						'react-dom': nextReactDomRoot,
						react: nextReactRoot,
					},
				},
				plugins: [react()],
				test: {
					name: { label: 'browser', color: 'yellow' },
					include: browserTestPatterns,
					setupFiles: ['./src/test/setup-browser.ts'],
					sequence: { groupOrder: 3 },
					browser: {
						enabled: true,
						headless: true,
						screenshotFailures: false,
						provider: playwright(),
						instances:
							isCoverage || isWatch
								? [{ browser: 'chromium' }]
								: [
										{ browser: 'chromium' },
										...browserInstances({ browser: 'webkit' }),
										// Firefox has an issue where parallelism within an instance steals focus between screens.
										// This disables file parallelism, but shards between instances to maintain speed.
										...browserInstances({ browser: 'firefox' }),
									],
						commands: { dragWithAnimation },
					},
				},
			},
		],
	},
});
