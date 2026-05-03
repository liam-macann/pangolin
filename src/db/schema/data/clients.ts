import { isNull } from 'drizzle-orm';
import { authenticatedRole } from 'drizzle-orm/neon';
import {
	boolean,
	foreignKey,
	snakeCase,
	text,
	unique,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

import { users } from '@/db/schema/auth';

import { authUid, policy, scdTable } from './_helpers';
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

		policy({
			role: authenticatedRole,
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
		name: varchar({ length: 255 }).notNull(),
		email: varchar({ length: 255 }).notNull(),
		notes: text(),

		addressId: uuid().references(() => address.id),
	},
	t => [
		// Necessary for ownership constraint on clientData
		unique('uq_client_data_user').on(t.id, t.userId),

		// Ensure that a client has only one valid configuration (multiple null values will conflict)
		uniqueIndex('uq_client_active_version').on(t.clientId).where(isNull(t.validTo)),

		foreignKey({
			name: 'fk_client_data_ownership',
			columns: [t.clientId, t.userId],
			foreignColumns: [clients.id, clients.userId],
		}),

		policy({
			role: authenticatedRole,
			select: authUid(t.userId),
			insert: authUid(t.userId),
			update: authUid(t.userId),
			delete: authUid(t.userId),
		}),
	],
);
