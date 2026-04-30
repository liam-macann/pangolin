import 'server-only';

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

import { relations } from './relations';
import { authenticated } from './schema/auth';

// Use a role-scoped connection string so RLS isn't bypassed by a superuser role
const pool = new Pool({
	user: authenticated.name,
	host: process.env.PGHOST,
	database: process.env.PGDATABASE,
	password: process.env.PGPASSWORD_AUTHENTICATED,
	port: 5432,
});

export const db = drizzle({
	client: pool,
	relations,
	casing: 'snake_case',
});

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
