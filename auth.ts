import { DrizzleAdapter } from '@auth/drizzle-adapter';
import bcrypt from 'bcrypt';
import NextAuth, { type Session, type User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { db } from '@/db';
import { accounts, authenticators, sessions, users } from '@/db/schema';
import { authConfig } from './auth.config';

async function getUser(email: string) {
	try {
		const user = await db.query.users.findFirst({
			where: (users, { eq }) => eq(users.email, email),
		});

		if (!user) throw new Error('User not found');

		return user;
	} catch (error) {
		console.error('Failed to fetch user:', error);
		throw new Error('Failed to fetch user.');
	}
}

// biome-ignore lint/correctness/noUnusedImports: Import needed for TS Module Augmentation
import type { JWT } from 'next-auth/jwt';

// Extend the built-in session and user types
declare module 'next-auth' {
	// Object is returned in Credentials authorize callback, from DB
	interface User {
		id: string;
		email: string;
	}
}

import { redirect } from 'next/navigation';
import type { Provider } from 'next-auth/providers';

const providers: Provider[] = [
	GitHub,
	Google,
	// Credentials({
	// 	async authorize(credentials) {
	// 		const parsedCredentials = z
	// 			.object({ email: z.email(), password: z.string().min(6) })
	// 			.safeParse(credentials);

	// 		if (parsedCredentials.success) {
	// 			const { email, password } = parsedCredentials.data;

	// 			const user = await getUser(email);
	// 			if (!user) return null;

	// 			const passwordsMatch = await bcrypt.compare(password, user.password);
	// 			if (passwordsMatch) return user;
	// 		}

	// 		console.log('Invalid credentials');
	// 		return null;
	// 	},
	// }),
];

export const providerMap = providers.map(provider => {
	if (typeof provider === 'function') {
		const providerData = provider();
		return { id: providerData.id, name: providerData.name };
	} else {
		return { id: provider.id, name: provider.name };
	}
});

export const {
	handlers,
	auth: _auth,
	signIn,
	signOut,
} = NextAuth({
	...authConfig,
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		authenticatorsTable: authenticators,
	}),
	session: { strategy: 'database' },
	callbacks: {
		session({ session, user }) {
			// Send user id to the client
			session.user.id = user.id;
			return session;
		},
	},
	providers,
});

export async function auth(): Promise<Session & { user: User }> {
	return _auth().then(session => {
		if (!session?.user?.id) redirect('/auth/login');

		// Safe assertion, due to previous check
		return session as Session & { user: User };
	});
}
