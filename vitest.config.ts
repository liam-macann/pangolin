import { createRequire } from 'node:module';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const libAddressRoot = path.dirname(require.resolve('lib-address/package.json'));

export default defineConfig({
	optimizeDeps: {
		include: [
			'react',
			'react/jsx-dev-runtime',
			'react-dom',
			'react-dom/client',
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
		alias: {
			// lib-address ESM node entry calls CJS require() to load metadata.
			// This causes issues under Vitest native ESM, so we use the CJS entry instead.
			'lib-address': path.join(libAddressRoot, 'dist/entry-node.cjs'),
		},
	},
	test: {
		setupFiles: ['./src/test/setup.ts'],
		clearMocks: true,
		coverage: {
			exclude: [
				...(configDefaults.coverage.exclude ?? []),
				'src/db/schema/**/*',
				'src/db/relations.ts',
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
					sequence: { groupOrder: 1 },
					include: ['src/**/*.test.ts'],
					setupFiles: ['./src/test/setup.ts', './src/test/setup-server.ts'],
				},
			},
			{
				extends: true,
				plugins: [react()],
				test: {
					name: { label: 'browser', color: 'yellow' },
					include: ['src/**/*.test.tsx', 'src/**/*.browser.test.ts'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
					},
				},
			},
		],
	},
});
