import { AsyncLocalStorage } from 'node:async_hooks';
import { vi } from 'vitest';

import { type Session } from '@/auth';

import { type TestTX } from './pglite';

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

vi.mock(import('react'), async importOriginal => {
	const actual = await importOriginal();
	return {
		...actual,
		experimental_taintObjectReference: vi.fn(),
		experimental_taintUniqueValue: vi.fn(),
	};
});
