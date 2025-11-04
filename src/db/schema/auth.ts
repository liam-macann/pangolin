import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Auth.js Data

import type { AdapterAccountType } from '@auth/core/adapters';

export const users = pgTable('user', {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: text('name').notNull(),
	email: text('email').unique().notNull(),
	password: text(),
	emailVerified: timestamp('email_verified', { mode: 'date' }),
	image: text('image'),
});

export const accounts = pgTable(
	'account',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').$type<AdapterAccountType>().notNull(),
		provider: text('provider').notNull(),
		providerAccountId: text('provider_account_id').notNull(),
		refresh_token: text('refresh_token'),
		access_token: text('access_token'),
		expires_at: integer('expires_at'),
		token_type: text('token_type'),
		scope: text('scope'),
		id_token: text('id_token'),
		session_state: text('session_state'),
	},
	account => [
		{
			compoundKey: primaryKey({
				columns: [account.provider, account.providerAccountId],
			}),
		},
	],
);

export const sessions = pgTable('session', {
	sessionToken: text('sessionToken').primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const authenticators = pgTable(
	'authenticator',
	{
		credentialID: text('credentialID').notNull().unique(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		providerAccountId: text('provider_account_id').notNull(),
		credentialPublicKey: text('credential_public_key').notNull(),
		counter: integer('counter').notNull(),
		credentialDeviceType: text('credential_device_type').notNull(),
		credentialBackedUp: boolean('credential_backed_up').notNull(),
		transports: text('transports'),
	},
	authenticator => [
		{
			compositePK: primaryKey({
				columns: [authenticator.userId, authenticator.credentialID],
			}),
		},
	],
);
