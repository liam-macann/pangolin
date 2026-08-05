/// <reference types="vitest/browser" />

import { createRequire } from 'node:module';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const libAddressRoot = path.dirname(require.resolve('lib-address/package.json'));

const args = process.argv.slice(2);

const isCoverage = args.includes('--coverage');
const isRun = args.includes('run') || args.includes('--run');
const isWatch = configDefaults.watch && !isRun;

export default defineConfig({
	optimizeDeps: {
		include: [
			'react',
			'react/jsx-dev-runtime',
			'react-dom',
			'react-dom/client',
			'vitest-browser-react/pure',
			'swr',
			'es-toolkit/object',
			'next/navigation',
			'next/cache',
			'next/server',
			'server-only',
		],
	},
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		setupFiles: ['./src/test/setup.ts'],
		clearMocks: true,
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
				resolve: {
					alias: {
						// lib-address ESM node entry calls CJS require() to load metadata.
						// This causes issues under Vitest native ESM, so server tests use its CJS entry.
						'lib-address$': path.join(libAddressRoot, 'dist/entry-node.cjs'),
						// Subpath imports
						'lib-address': libAddressRoot,
					},
				},
				test: {
					name: { label: 'server', color: 'green' },
					environment: 'node',
					isolate: false,
					// Each worker will have to spin up a new DB instance, which adds considerable overhead.
					// Increased parallelism may make sense with a larger volume of tests.
					maxWorkers: 2,
					sequence: { groupOrder: 1 },
					include: ['src/**/*.test.ts'],
					setupFiles: ['./src/test/setup.ts', './src/test/setup-server.ts'],
				},
			},
			{
				extends: true,
				resolve: {
					alias: {
						'lib-address$': path.join(libAddressRoot, 'dist/entry-browser.cjs'),
						'lib-address': libAddressRoot,
					},
				},
				plugins: [react()],
				test: {
					name: { label: 'browser', color: 'yellow' },
					include: ['src/**/*.test.tsx', 'src/**/*.browser.test.ts'],
					setupFiles: ['./src/test/setup-browser.ts'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances:
							isCoverage || isWatch
								? [{ browser: 'chromium' }]
								: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
					},
				},
			},
		],
	},
});
