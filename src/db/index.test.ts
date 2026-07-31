import { sql } from 'drizzle-orm';
import * as navigation from 'next/navigation';
import { assert, describe, expect, test, vi } from 'vitest';

import { insertTestClient } from '@/lib/actions/tests/helpers';
import { withRLS } from '@/db';
import * as schema from '@/db/schema';

import { getSession } from '@/auth';
import { asUser, createTestSession } from '@/test/session';

describe('withRLS()', () => {
	test('Single-argument overload calls unauthorized() when there is no session', async () => {
		await expect(withRLS(async () => {})).rejects.toThrow();
		expect(navigation.unauthorized).toHaveBeenCalled();
	});

	asUser(
		'Single-argument overload opens a transaction, resolves the caller session and runs the callback',
		async ({ session }) => {
			const result = await withRLS(async (tx, callbackSession) => {
				expect(callbackSession.user.id).toBe(session.user.id);
				await tx.execute(sql`SELECT 1`);
				return 'ok';
			});

			expect(result).toBe('ok');
		},
	);

	asUser(
		'Trusted-session overload opens a transaction for the given session and runs the callback',
		async ({ session }) => {
			const result = await withRLS(session, async tx => {
				await tx.execute(sql`SELECT 1`);
				return 'ok';
			});

			expect(result).toBe('ok');

			// The trusted-session overload must never resolve its own session.
			// It should be safe to call inside a `use cache` function.
			expect(getSession).not.toHaveBeenCalled();
		},
	);

	asUser(
		'Trusted-session overload scopes RLS to the passed session, not the ambient one',
		async ({ db, auth }) => {
			const { id } = await insertTestClient();

			const otherSession = await createTestSession(db, auth);
			const rows = await withRLS(otherSession, async tx => tx.select().from(schema.clients));

			expect(rows.map(row => row.id)).not.toContain(id);
		},
	);

	describe('Nested calls', () => {
		// By default, nested Drizzle transactions trigger a SAVEPOINT
		// withRLS() semantics allow deeply nested calls, with atomicity guarantees
		// It should therefore not be treated as an implicit transaction
		asUser('Nested withRLS() call does not open a SAVEPOINT', async ({ session }) => {
			// A real SQL-level error is required to prove this.
			// Postgres itself aborts the surrounding transaction (nested transactions are not allowed)
			// proving the call has not been converted to a SAVEPOINT
			const err = await withRLS(async tx => {
				// This nested query will always fail
				await expect(withRLS(() => tx.execute(sql`SELECT 1 / 0`))).rejects.toThrow();

				// If the nested call had opened a SAVEPOINT, rolling back to it would have
				// recovered the transaction and this query would succeed.
				await tx.execute(sql`SELECT 1`);
			}).catch(err => err);

			const trustedErr = await withRLS(async tx => {
				await expect(withRLS(session, () => tx.execute(sql`SELECT 1 / 0`))).rejects.toThrow();
				await tx.execute(sql`SELECT 1`);
			}).catch(err => err);

			assert(err instanceof Error, 'Expected the outer withRLS() call to reject');
			assert(err.cause instanceof Error && 'code' in err.cause, 'Expected a Postgres driver error');

			// 25P02: "current transaction is aborted, commands ignored until end of transaction block"
			// Only reachable if the nested withRLS() call shared the outer transaction, rather than isolating failure to a SAVEPOINT
			expect(err.cause.code).toBe('25P02');
			expect(trustedErr).toEqual(err);
		});

		asUser('Nested withRLS() reuse the enclosing transaction and session', async ({ session }) => {
			// Single-argument overload (outer context)
			await withRLS(async (outerTx, outerSession) => {
				await withRLS(async (innerTx, innerSession) => {
					expect(innerTx).toBe(outerTx);
					expect(innerSession).toBe(outerSession);
				});

				await withRLS(session, async innerTx => expect(innerTx).toBe(outerTx));
			});

			// Trusted-session overload (outer context)
			await withRLS(session, async outerTx => {
				await withRLS(session, async innerTx => expect(innerTx).toBe(outerTx));
				await withRLS(async (innerTx, innerSession) => {
					expect(innerTx).toBe(outerTx);
					expect(innerSession).toBe(session);
				});
			});

			// Only the single-argument enclosing context (in this suite, the very first call) may resolve a session.
			// Nested calls, and the trusted-session overload, must not resolve a session.
			expect(getSession).toHaveBeenCalledTimes(1);

			// Matching sessions must never trip the mismatch guard that nested calls share
			expect(navigation.forbidden).not.toHaveBeenCalled();
		});

		asUser(
			'Nesting a trusted-session overload with session that does not match enclosing context will throw',
			async ({ db, auth, session }) => {
				const otherSession = await createTestSession(db, auth);

				// Trusted-session within callback overload
				await expect(
					withRLS(async () => await withRLS(otherSession, async () => {})),
				).rejects.toThrow();

				expect(navigation.forbidden).toHaveBeenCalledTimes(1);
				vi.clearAllMocks();

				// Trusted-session within another trusted-session overload
				await expect(
					withRLS(session, async () => await withRLS(otherSession, async () => {})),
				).rejects.toThrow();

				expect(navigation.forbidden).toHaveBeenCalledTimes(1);
			},
		);
	});

	describe('withRLS() is what makes RLS-protected queries work', () => {
		asUser('The same query fails outside withRLS()', async ({ db, session }) => {
			// The asUser fixture is run in a transaction context, which withRLS() consumes.
			// Calling insertTestClient() would trigger a nested withRLS() call, setting the app.user_id variable.
			// This would not be reset until the enclosing transaction is committed.
			await db.execute(sql`SET LOCAL ROLE neondb_owner`);
			await db.insert(schema.clients).values({ userId: session.user.id });
			await db.execute(sql`SET LOCAL ROLE authenticated`);

			const err = await db
				.select()
				.from(schema.clients)
				.catch(err => err);

			assert(err instanceof Error, 'Expected the query to reject');
			assert(err.cause instanceof Error && 'code' in err.cause, 'Expected a Postgres driver error');

			// Postgres error differs by whether an earlier test has registered app.user_id.
			// The value will not be defined in either case.

			// 22P02: INVALID TEXT REPRESENTATION
			// Occurs when trying to cast the empty variable into a UUID
			//
			// 42704: UNDEFINED OBJECT
			// Occurs when the app.user_id placeholder is not registered
			expect(['42704', '22P02']).toContain(err.cause.code);
		});

		asUser('The same query succeeds through withRLS()', async () => {
			const { id } = await insertTestClient();

			const rows = await withRLS(async db => await db.select().from(schema.clients));
			expect(rows.map(row => row.id)).toContain(id);
		});
	});
});
