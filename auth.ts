import 'server-only';

import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import { drizzle } from 'drizzle-orm/neon-http';
import { headers } from 'next/headers';
import { cache } from 'react';

import * as relations from '@/db/relations';
import * as schema from '@/db/schema';

// Use super-user connection string to bypass RLS
// biome-ignore lint/style/noNonNullAssertion: Connection URL is guaranteed to be defined in production
export const db = drizzle({ connection: process.env.DATABASE_URL! });

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		schema: { ...schema, ...relations },
		provider: 'pg',
		usePlural: true,
	}),
	// experimental: { joins: true },
	errorURL: '/auth/error',
	onAPIError: { errorURL: '/auth/error' },
	socialProviders: {
		google: {
			clientId: process.env.AUTH_GOOGLE_ID as string,
			clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
		},
	},
	advanced: {
		database: { generateId: false },
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // Cache duration in seconds
		},
	},
});

export const { signOut, signInSocial } = auth.api;

export type Session = typeof auth.$Infer.Session;

export const getSession = cache(
	async (ctx?: Parameters<typeof auth.api.getSession>[0]) =>
		await auth.api.getSession({
			headers: await headers(),
			...ctx,
		}),
);
