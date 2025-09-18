import { sql } from 'drizzle-orm';
import {
	boolean,
	foreignKey,
	integer,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const statusEnum = pgEnum('status', ['unpaid', 'paid']);
export const invoices = pgTable(
	'invoice',
	{
		id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		clientId: uuid('client_id').notNull(),
		amount: numeric({ precision: 15, scale: 4, mode: 'number' }).notNull(),
		status: statusEnum().notNull(),
		date: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(),
	},
	table => [
		foreignKey({
			name: 'client_fk',
			columns: [table.clientId, table.userId],
			foreignColumns: [clients.id, clients.userId],
		}),
	],
);

export const clients = pgTable(
	'client',
	{
		id: uuid().default(sql`uuid_generate_v4()`).unique().notNull(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		name: varchar({ length: 255 }).notNull(),
		email: varchar({ length: 255 }).notNull(),
	},
	t => [primaryKey({ name: 'client_user_pk', columns: [t.id, t.userId] })],
);

export const config = pgTable('config', {
	userId: uuid('user_id')
		.primaryKey()
		.references(() => users.id),
	// The time zone of record, for invoice dates and yearly sequencing. This should eventually reference a table of time zones.
	timezone: text().notNull().default('Australia/Sydney'),
});

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
