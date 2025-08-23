import { DrizzleAdapter } from '@auth/drizzle-adapter';
import bcrypt from 'bcrypt';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
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
	}
}

declare module 'next-auth/jwt' {
	interface JWT {
		id: string;
	}
}

export const { auth, signIn, signOut } = NextAuth({
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
	providers: [
		Credentials({
			async authorize(credentials) {
				const parsedCredentials = z
					.object({ email: z.email(), password: z.string().min(6) })
					.safeParse(credentials);

				if (parsedCredentials.success) {
					const { email, password } = parsedCredentials.data;

					const user = await getUser(email);
					if (!user) return null;

					const passwordsMatch = await bcrypt.compare(password, user.password);
					if (passwordsMatch) return user;
				}

				console.log('Invalid credentials');
				return null;
			},
		}),
	],
});
