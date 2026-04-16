import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	foreignKey,
	pgTable,
	text,
	unique,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

import { users } from '@/db/schema/auth';

import { scdDates } from './_helpers';
import { address } from './address';

// Logical client. Data is stored in SCD table.
export const clients = pgTable(
	'client',
	{
		id: uuid().defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		isFavorite: boolean('is_favorite').notNull().default(false),
		isDeleted: boolean('is_deleted').notNull().default(false),
	},
	// Necessary for ownership constraint on clientData
	t => [unique('uq_client_user').on(t.id, t.userId)],
);

//
//
//
// SCD v2
//
// Slowly changing dimension (SCD) — history table necessary for stable invoice references

// All data used to construct invoice should be here
export const clientData = pgTable(
	'client_data',
	{
		id: uuid().defaultRandom().primaryKey(),
		// Denormalised to allow DB-level ownership constraint
		userId: uuid('user_id')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		clientId: uuid('client_id')
			.references(() => clients.id, { onDelete: 'cascade' })
			.notNull(),
		name: varchar({ length: 255 }).notNull(),
		email: varchar({ length: 255 }).notNull(),
		notes: text('notes'),

		addressId: uuid('address_id').references(() => address.id),
		...scdDates,
	},
	t => [
		// Necessary for ownership constraint on clientData
		unique('uq_client_data_user').on(t.id, t.userId),
		// Ensure that a client has only one valid configuration (multiple null values will conflict)
		unique('uq_client_version').on(t.clientId, t.validTo).nullsNotDistinct(),
		foreignKey({
			name: 'fk_client_data_ownership',
			columns: [t.clientId, t.userId],
			foreignColumns: [clients.id, clients.userId],
		}),
		check('chk_client_data_valid', sql`${t.validFrom} <= now()`),
	],
);
