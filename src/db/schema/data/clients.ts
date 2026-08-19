import { isNull, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	snakeCase,
	text,
	unique,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';

import { users } from '@/db/schema/auth';

import { authUid, policy, relationOwnership, scdTable } from './_helpers';
import { address } from './address';

// Logical client. Data is stored in SCD table.
export const clients = snakeCase.table(
	'client',
	{
		id: uuid().defaultRandom().primaryKey(),
		userId: uuid()
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		isFavorite: boolean().notNull().default(false),
		isDeleted: boolean().notNull().default(false),
	},
	// Necessary for ownership constraint on clientData
	t => [
		unique('uq_client_user').on(t.id, t.userId),

		index('idx_client_user_id').on(t.userId),

		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			update: authUid(t.userId),
			delete: authUid(t.userId),
		}),
	],
);

//
//
//
// SCD v2
//
// Slowly changing dimension (SCD) — history table necessary for stable invoice references

// All data used to construct invoice should be here
export const clientData = scdTable(
	'client_data',
	{
		id: uuid().defaultRandom().primaryKey(),
		// Denormalised to allow DB-level ownership constraint
		userId: uuid()
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		clientId: uuid()
			.references(() => clients.id, { onDelete: 'cascade' })
			.notNull(),
		name: text(),
		organization: text(),
		email: text().notNull(),
		notes: text(),

		addressId: uuid().references(() => address.id),
	},
	t => [
		// Necessary for ownership constraint on clientData
		unique('uq_client_data_user').on(t.id, t.userId),

		// Ensure that a client has only one valid configuration (multiple null values will conflict)
		uniqueIndex('uq_client_active_version').on(t.clientId).where(isNull(t.validTo)),

		index('idx_client_data_user_id').on(t.userId),
		index('idx_client_data_client_id').on(t.clientId),
		index('idx_client_data_address_id').on(t.addressId),

		check('chk_name_or_org', sql`${t.name} IS NOT NULL OR ${t.organization} IS NOT NULL`),

		check('chk_client_name_length', sql`char_length(${t.name}) <= 255`),
		check('chk_client_organization_length', sql`char_length(${t.organization}) <= 255`),
		check('chk_client_email_length', sql`char_length(${t.email}) <= 255`),
		check('chk_client_notes_length', sql`char_length(${t.notes}) <= 1000`),

		relationOwnership(t.clientId, clients),
		relationOwnership(t.addressId, address),

		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			update: false,
			delete: authUid(t.userId),
		}),
	],
);
