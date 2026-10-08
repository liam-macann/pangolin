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

/** Runs a `callback` against the current test transaction as the superuser role, bypassing RLS.
 *  @remarks RLS stays bypassed inside any `withRLS()` the callback reaches, leaving only application checks.
 *  @throws When called outside of a test environment, or without a test transaction. */
export async function bypassRLS<T>(callback: (tx: TestTX) => PromiseLike<T>): Promise<T> {
	if (process.env.NODE_ENV !== 'test') throw new Error('bypassRLS() is only available in tests');

	const tx = testConnection.getStore();
	if (!tx) throw new Error('bypassRLS() called without a test database: use the `asUser` fixture');

	// A nested call finds the bypass already granted by the outer one, and must leave it in place
	const [{ role, isNested }] = await tx
		.select({
			role: sql<string>`current_setting('role')`,
			isNested: sql<boolean>`rolbypassrls`,
		})
		.from(sql`pg_roles`)
		.where(sql`rolname = 'authenticated'`);

	const becomeSuperuser = () => tx.execute(sql`SET LOCAL ROLE neondb_owner`);

	await becomeSuperuser();
	await tx.execute(sql`ALTER ROLE authenticated BYPASSRLS`);

	const restore = async () => {
		// Only a superuser may alter roles, and withRLS() may have switched away
		await becomeSuperuser();

		// If no longer under a withRLS() scope, return that role to default
		if (!isNested) await tx.execute(sql`ALTER ROLE authenticated NOBYPASSRLS`);

		// Restores the role it was called under, so bypassRLS() may be nested
		await tx.execute(sql`SELECT set_config('role', ${role}, true)`);
	};

	try {
		const result = await callback(tx);
		await restore();
		return result;
	} catch (err) {
		// A failed statement aborts the transaction, so restoration may also fail.
		await restore().catch(() => {});
		throw err;
	}
}

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

/** Creates and logs in a fresh user within the current test transaction.
 *  @remarks Better Auth writes as neondb_owner in production (a separate, superuser connection), bypassing RLS */
export async function createTestSession(auth: ReturnType<typeof createTestAuth>) {
	const { test: helpers } = await auth.$context;

	return bypassRLS(async () => {
		// Better Auth helper does not generate UUID id by default
		const user = await helpers.saveUser(helpers.createUser({ id: randomUUID() }));
		const { session } = await helpers.login({ userId: user.id });

		return { user, session };
	});
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
							// A rollback skips commit-time checks, so run them here
							await tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`).catch(err => {
								// 25P02: the test left the transaction aborted, so nothing is pending
								if (err?.cause?.code !== '25P02') throw err;
							});
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
	// A fixture runs before the test transaction is bound for the test, so binds it here
	.extend('session', ({ db, auth }) => testConnection.run(db, () => createTestSession(auth)));
