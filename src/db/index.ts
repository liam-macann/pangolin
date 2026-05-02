import 'server-only';

import { Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

import { type Brand } from '@/lib/utils';
import { relations } from '@/db/relations';
import { authenticated } from '@/db/schema/auth';

import { getSession, type Session } from '@/auth';

// Use a role-scoped connection string so RLS isn't bypassed by a superuser role
const pool = new Pool({
	user: authenticated.name,
	host: process.env.PGHOST,
	database: process.env.PGDATABASE,
	password: process.env.PGPASSWORD_AUTHENTICATED,
	port: 5432,
});

/** @internal */
const db = drizzle({ client: pool, relations });

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Indicates a transaction context with an authenticated user, exposed under `app.user_id` */
export type AuthTransaction = Brand<Transaction, 'AuthTransaction'>;

/**
 * Resolves the Better Auth session from request headers, then wraps your
 * Drizzle calls in a transaction that sets the authenticated user for RLS.
 */
export const withRLS = async <T>(
	callback: (tx: AuthTransaction, session: Session) => Promise<T>,
): Promise<T> => {
	const session = await getSession();
	if (!session) throw new Error('Unauthenticated');

	return db.transaction(async tx => {
		// Super-users and table owners bypass RLS restrictions.
		// The connection string, used for migrations, is not allowed to set roles.
		// This causes a loud failure if the wrong connection is used.
		await tx.execute(sql`SET LOCAL ROLE authenticated`);

		// Inject the claims into the transaction session context
		await tx.execute(sql`SELECT set_config('app.user_id', ${session.user.id}, true)`);

		// Run the user's query against the isolated session
		return callback(tx as AuthTransaction, session);
	});
};
