import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const libAddressRoot = path.dirname(require.resolve('lib-address/package.json'));

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
		alias: {
			// lib-address ESM node entry calls CJS require() to load metadata.
			// This causes issues under Vitest native ESM, so we use the CJS entry instead.
			'lib-address': path.join(libAddressRoot, 'dist/entry-node.cjs'),
		},
	},
	test: {
		environment: 'node',
		setupFiles: ['./src/test/setup.ts'],
	},
});
