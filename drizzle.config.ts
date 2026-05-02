import './env-config.js';

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: './drizzle',
	schema: './src/db/schema/index.ts',
	dialect: 'postgresql',
	dbCredentials: {
		// biome-ignore lint/style/noNonNullAssertion: DB URL is always present
		url: process.env.DATABASE_URL!,
	},
});
