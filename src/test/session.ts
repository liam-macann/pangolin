import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { betterAuth } from 'better-auth/minimal';
import { testUtils } from 'better-auth/plugins';
import { sql } from 'drizzle-orm';
import { test, vi } from 'vitest';

import * as schema from '@/db/schema/auth';

import { type Session } from '@/auth';

import { createTestDB, type TestTX } from './pglite';

/** Stores the current test transaction separately according to each calling async context */
export const testConnection = new AsyncLocalStorage<TestTX>();

/** Memoized worker-scoped PGlite instance, kicked off eagerly during file setup */
let clientPromise: ReturnType<typeof createTestDB> | undefined;
export const warmClient = async () => (clientPromise ??= createTestDB());

/** Stores the current session separately according to each calling async context */
export const sessionStorage = new AsyncLocalStorage<Session>();

/** Mocked getSession() that accesses test AsyncLocalStorage */
export const getSessionMock = vi.fn(async () => sessionStorage.getStore() ?? null);

/** A test-only Better Auth instance pointed at the disposable PGlite connection */
export function createTestAuth(db: TestTX) {
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

/** Creates and logs in a fresh user within the current fixture transaction.
 *
 *  @remarks Better Auth writes as neondb_owner in production (a separate, superuser connection), bypassing RLS */
export async function createTestSession(db: TestTX, auth: ReturnType<typeof createTestAuth>) {
	const { test: helpers } = await auth.$context;

	await db.execute(sql`SET LOCAL ROLE neondb_owner;`);

	// Better Auth helper does not generate UUID id by default
	const user = await helpers.saveUser(helpers.createUser({ id: randomUUID() }));
	const { session } = await helpers.login({ userId: user.id });

	await db.execute(sql`SET LOCAL ROLE authenticated;`);

	return { user, session };
}

/** Sentinel error used to force a rollback */
const ROLLBACK = new Error('rollback');

/** Vitest fixture to simulate a user connection with:
 *  - a disposable PGlite database
 *  - a bound Better Auth instance
 *  - a logged-in session
 *  - a per-test transaction, rolled back to prevent leaks
 */
export const asUser = test
	// biome-ignore lint/correctness/noEmptyPattern: Vitest fixture parser requires literal object-destructuring syntax
	.extend('client', { scope: 'worker' }, async ({}, { onCleanup }) => {
		const client = await warmClient();
		onCleanup(() => client.$client.close());
		return client;
	})
	.extend<{ db: TestTX }>({
		db: [
			async ({ client }, use) => {
				await client
					.transaction(tx =>
						testConnection.run(tx, async () => {
							await use(tx);
							throw ROLLBACK;
						}),
					)
					.catch(err => {
						if (err !== ROLLBACK) throw err;
					});
			},
			// Forces fixture to run even if not destructured in the test.
			// Production code may access DB, even if test does not.
			{ auto: true },
		],
	})
	.extend('auth', ({ db }) => createTestAuth(db))
	.extend('session', ({ db, auth }) => createTestSession(db, auth));
