import 'server-only';

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { parse } from 'pg-connection-string';

import { relations } from '@/db/relations';
import { authenticated } from '@/db/schema/auth';

const parsed = parse(process.env.DATABASE_URL as string);
if (!parsed.host || !parsed.database) throw new Error('DATABASE_URL is not set');

// Use a role-scoped connection string so RLS isn't bypassed by a superuser role
const pool = new Pool({
	user: authenticated.name,
	host: parsed.host,
	database: parsed.database,
	password: process.env.PGPASSWORD_AUTHENTICATED,
	port: 5432,
});

/** @internal */
export const db = drizzle({ client: pool, relations });
