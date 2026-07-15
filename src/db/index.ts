import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import { unauthorized } from 'next/navigation';

import { type Brand } from '@/lib/utils';

import { getSession, type Session } from '@/auth';

import { db } from './connection';

export { db };

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Indicates a transaction context with an authenticated user, exposed under `app.user_id` */
export type AuthTransaction = Brand<Transaction, 'AuthTransaction'>;

/** Tracks the transaction and session of the innermost enclosing `withRLS()` call,
 *  scoped per async call chain (so concurrent requests never see each other's store)
 *
 *  Allows nested `withRLS()` calls to reuse the outer scope instead of opening a second connection.
 *
 *  @remarks No savepoint is introduced when nesting; the outer `withRLS()` call retains atomicity */
const rlsContext = new AsyncLocalStorage<{ tx: AuthTransaction; session: Session }>();

function openTransaction<T>(
	session: Session,
	callback: (tx: AuthTransaction, session: Session) => Promise<T>,
): Promise<T> {
	return db.transaction(async tx => {
		// Super-users and table owners bypass RLS restrictions.
		// The connection string, used for migrations, is not allowed to set roles.
		// This causes a loud failure if the wrong connection is used.
		await tx.execute(sql`SET LOCAL ROLE authenticated`);

		// Inject the claims into the transaction session context
		await tx.execute(sql`SELECT set_config('app.user_id', ${session.user.id}, true)`);

		// Brand the transaction type
		const authTx = tx as AuthTransaction;

		// Run the user's query against the isolated session
		return rlsContext.run({ tx: authTx, session }, () => callback(authTx, session));
	});
}

/**
 * Resolves the Better Auth session from request headers, then wraps your
 * Drizzle calls in a transaction that sets the authenticated user for RLS.
 */
export async function withRLS<T>(
	callback: (tx: AuthTransaction, session: Session) => Promise<T>,
): Promise<T>;
/**
 * Trusted-session variant: skips authentication so is safe to call inside a `use cache` function.
 *
 * The caller is responsible for validating the session before passing it. If called inside an
 * enclosing `withRLS()` for a different user, throws rather than opening a second transaction.
 */
export async function withRLS<T>(
	session: Session,
	// Omit session in callback type, to prevent implying the session has been verified
	callback: (tx: AuthTransaction) => Promise<T>,
): Promise<T>;

export async function withRLS<T>(
	...args:
		| [(tx: AuthTransaction, session: Session) => Promise<T>]
		| [Session, (tx: AuthTransaction) => Promise<T>]
): Promise<T> {
	const existing = rlsContext.getStore();

	// If using the trusted-session overload
	if (args.length === 2) {
		const [session, callback] = args;

		if (existing) {
			// A mismatched user here means a caller passed the wrong session, or attempted
			// to nest a different user operation inside this one.

			// SET LOCAL settings apply for the rest of the outer scope as well,
			// so silently proceeding would leave it running as the wrong user once this callback returns.

			if (existing.session.user.id !== session.user.id)
				throw new Error('withRLS() called with a different user than the enclosing transaction');

			return callback(existing.tx);
		}

		return openTransaction(session, callback);
	}

	const [callback] = args;
	if (existing) return callback(existing.tx, existing.session);

	const session = (await getSession()) ?? unauthorized();
	return openTransaction(session, callback);
}
