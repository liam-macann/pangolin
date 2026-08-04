import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { registerCountry } from 'lib-address';
import { vi } from 'vitest';

import { asUser, getSession, sessionStorage, testConnection, warmClient } from './session';

// Pays the PGlite worker-instance startup cost here, during file setup,
// so it isn't misattributed to whichever test happens to run first in this worker
await warmClient();

// lib-address tries to eagerly register every country on import, but the registration loop
// calls CJS require() from ESM, and fails in Vitest
//
// This reimplements default server registration behaviour
const require = createRequire(import.meta.url);
const countriesDir = path.join(
	path.dirname(require.resolve('lib-address/package.json')),
	'countries',
);

for (const file of readdirSync(countriesDir).filter(file => /^[A-Z]{2}\.json$/.test(file))) {
	registerCountry(require(path.join(countriesDir, file)));
}

// Allow server-only files to be imported outside of Next.js server context
vi.mock('server-only', () => ({}));

// Implement from __mocks__ directory
// This provides a stable identity across test files, necessary with isolation disabled
vi.mock('next/server');

// The real DB connection must never run in a test
vi.mock('@/db/connection', () => ({
	get db() {
		if (!testConnection.current) {
			throw new Error(
				'@/db accessed without a test database initialized. Use the `asUser` fixture from @/test/session',
			);
		}
		return testConnection.current;
	},
}));

// getSession() is typed to return `Session | null`.
// A test without the `session` fixture will hit the same unauthorized() path production code would
vi.mock('@/auth', () => ({ getSession }));

// This is what lets concurrently-running tests each see their own session
asUser.aroundEach(
	async (runTest, { session }) => await sessionStorage.run(session, () => runTest()),
);

vi.mock(import('react'), async importOriginal => {
	const actual = await importOriginal();
	return {
		...actual,
		experimental_taintObjectReference: vi.fn(),
		experimental_taintUniqueValue: vi.fn(),
	};
});
