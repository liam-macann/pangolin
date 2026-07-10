import { randomUUID } from 'node:crypto';
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { betterAuth } from 'better-auth/minimal';
import { testUtils } from 'better-auth/plugins';
import { test as base } from 'vitest';

import * as schema from '@/db/schema/auth';

import { createTestDb, type TestTx } from './pglite';
import { sessionStorage, testConnection } from './setup';

/** A test-only Better Auth instance pointed at the disposable PGlite connection */
export function createTestAuth(db: TestTx) {
	return betterAuth({
		database: drizzleAdapter(db, {
			schema,
			provider: 'pg',
			usePlural: true,
		}),
		baseURL: { allowedHosts: ['localhost:*'] },
		experimental: { joins: true },
		plugins: [testUtils()],
		advanced: { database: { generateId: false } },
	});
}

/** Vitest `test()` with fixtures to simulate a user connection with:
 *
 *  - a disposable PGlite database
 *  - a Better Auth instance pointed at it
 *  - a logged-in session
 *  - a per-test transaction, rolled back so that no state leaks between tests
 */
export const asUser = base
	// biome-ignore lint/correctness/noEmptyPattern: Vitest's fixture parser requires literal object-destructuring syntax
	.extend('client', { scope: 'file' }, async ({}, { onCleanup }) => {
		const client = await createTestDb();
		onCleanup(async () => await client.$client.close());
		return client;
	})

	.extend<{ db: TestTx }>({
		db: [
			async ({ client }, use) => {
				const ROLLBACK = new Error('rollback');
				try {
					await client.transaction(async tx => {
						testConnection.current = tx;
						await use(tx);
						throw ROLLBACK;
					});
				} catch (err) {
					if (err !== ROLLBACK) throw err;
				} finally {
					testConnection.current = null;
				}
			},
			// Forces fixture to run even if not destructured in the test
			// Production code may access DB even if test does not
			{ auto: true },
		],
	})

	.extend('auth', async ({ db }) => createTestAuth(db))
	.extend('session', async ({ auth }) => {
		const { test: helpers } = await auth.$context;

		// Better Auth helper does not generate UUID id by default
		const user = await helpers.saveUser(helpers.createUser({ id: randomUUID() }));

		const { session } = await helpers.login({ userId: user.id });
		return { user, session };
	});

// This is what lets concurrently-running tests each see their own session.
asUser.aroundEach(async (runTest, { session }) => {
	await sessionStorage.run(session, () => runTest());
});
