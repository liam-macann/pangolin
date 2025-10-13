import { drizzle } from 'drizzle-orm/neon-http';
import * as relations from './relations';
import * as schema from './schema';

export const db = drizzle({
	// biome-ignore lint/style/noNonNullAssertion: Connection URL is guaranteed to be defined in production
	connection: process.env.DATABASE_URL!,
	schema: { ...schema, ...relations },
	casing: 'snake_case',
});
