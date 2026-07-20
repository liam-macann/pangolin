import { AsyncLocalStorage } from 'node:async_hooks';
import { bytesToHex, randomBytes } from '@noble/ciphers/utils.js';
import { vi } from 'vitest';

import { type Session } from '@/auth';

import { type TestTX } from './pglite';

// Allow server-only files to be imported outside of Next.js server context
vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({ updateTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('next/server', () => ({ after: vi.fn((cb: () => unknown) => cb()) }));

// The real DB connection must never run in a test
export const testConnection: { current: TestTX | null } = { current: null };
vi.mock('@/db/connection', () => ({
	get db() {
		if (!testConnection.current) {
			throw new Error(
				'@/db accessed without a test database initialized. Use the `asUser` fixture from @/src/test/session',
			);
		}
		return testConnection.current;
	},
}));

// Reading from AsyncLocalStorage lets concurrently-running tests
// each see only their own session instead of racing on one mock.
export const sessionStorage = new AsyncLocalStorage<Session>();

// getSession() is typed to return `Session | null`.
// A test without the `session` fixture will hit the same unauthorized() path production code would
vi.mock('@/auth', () => ({
	getSession: vi.fn(async () => sessionStorage.getStore() ?? null),
}));

vi.stubEnv('DB_ENCRYPTION_SECRET', bytesToHex(randomBytes(32)));

vi.mock(import('react'), async importOriginal => {
	const actual = await importOriginal();
	return {
		...actual,
		experimental_taintObjectReference: vi.fn(),
		experimental_taintUniqueValue: vi.fn(),
	};
});
