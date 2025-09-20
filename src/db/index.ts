import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema, casing: 'snake_case' });

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
