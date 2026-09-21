/// <reference types="vitest/browser" />

import { createRequire } from 'node:module';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';

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

export default defineConfig({
	optimizeDeps: {
		entries: ['src/**/*.test.tsx', 'src/**/*.browser.test.ts'],
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

				'src/db/index.ts',
				'src/db/schema/data/_helpers.ts',

				'src/components/**/*.tsx',
			],
			exclude: [
				...(configDefaults.coverage.exclude ?? []),
				'src/app/lib/auth.ts',
				'src/app/ui/fonts.ts',
				'src/app/ui/color-schemes.ts',
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
					include: ['src/**/*.test.ts'],
					exclude: ['src/app/api/**/*.test.ts'],
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
					include: ['src/**/*.test.tsx', 'src/**/*.browser.test.ts'],
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
								: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
						commands: { dragWithAnimation },
					},
				},
			},
		],
	},
});
