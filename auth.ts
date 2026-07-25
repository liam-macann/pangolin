import 'server-only';

import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { betterAuth } from 'better-auth/minimal';
import { nextCookies } from 'better-auth/next-js';
import { drizzle } from 'drizzle-orm/neon-http';
import { headers } from 'next/headers';
import { cache } from 'react';

import { authRelations } from '@/db/relations';
import * as schema from '@/db/schema/auth';

// Use super-user connection string to bypass RLS
const db = drizzle({
	connection: process.env.DATABASE_URL as string,
	relations: authRelations,
});

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		schema,
		provider: 'pg',
		usePlural: true,
	}),
	baseURL:
		process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview'
			? {
					allowedHosts: [
						process.env.VERCEL_URL,
						process.env.VERCEL_BRANCH_URL,
						process.env.VERCEL_PROJECT_PRODUCTION_URL,
					].filter((v): v is string => typeof v === 'string'),
					fallback: process.env.VERCEL_PROJECT_PRODUCTION_URL,
				}
			: process.env.BETTER_AUTH_URL,
	errorURL: '/auth/error',
	onAPIError: { errorURL: '/auth/error' },
	socialProviders: {
		google: {
			clientId: process.env.AUTH_GOOGLE_ID as string,
			clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
		},
	},
	plugins: [nextCookies()],
	advanced: {
		cookiePrefix: 'invoicer',
		// Safari drops Secure cookies on localhost
		useSecureCookies: process.env.NODE_ENV === 'production',
		database: { generateId: false, joins: true },
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
