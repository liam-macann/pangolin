import 'server-only';

import { sql } from 'drizzle-orm';
import { headers } from 'next/headers';

import { auth } from '@/auth';

import { db, type Transaction } from './index';

/**
 * Resolves the Better Auth session from request headers, then wraps your
 * Drizzle calls in a transaction that sets `app.current_user_id` for RLS.
 */
export const withRLS = async <T>(callback: (tx: Transaction) => Promise<T>): Promise<T> => {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) throw new Error('Unauthenticated');

	return db.transaction(async tx => {
		// Super-users and table owners bypass RLS restrictions.
		// The connection string, used for migrations, is not allowed to set roles.
		// This causes a loud failure if the wrong connection is used.
		await tx.execute(sql`SET LOCAL ROLE authenticated`);

		// Inject the claims into the transaction session context
		await tx.execute(sql`SELECT set_config('app.user_id', ${session.user.id}, true)`);

		// Run the user's query against the isolated session
		return callback(tx);
	});
};
