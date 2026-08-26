import { Pool } from '@neondatabase/serverless';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

import * as schema from '@/db/schema';

import './../env-config.ts';

export const relations = defineRelations(schema, r => ({
	users: {
		accounts: r.many.accounts(),
		sessions: r.many.sessions(),
	},
	accounts: {
		user: r.one.users({
			from: r.accounts.userId,
			to: r.users.id,
		}),
	},
	sessions: {
		user: r.one.users({
			from: r.sessions.userId,
			to: r.users.id,
		}),
	},
}));

export const db = drizzle({
	client: new Pool({ connectionString: process.env.DATABASE_URL }),
	relations,
});

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
