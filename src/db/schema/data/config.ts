import { type SQL, sql } from 'drizzle-orm';
import { authenticatedRole } from 'drizzle-orm/neon';
import {
	boolean,
	char,
	check,
	foreignKey,
	integer,
	numeric,
	pgEnum,
	primaryKey,
	snakeCase,
	text,
	unique,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

import { encrypted } from '@/lib/utils/drizzle';
import { users } from '@/db/schema/auth';
import { currencies, supportedTimezones } from '@/db/schema/i18n';

import { authUid, policy, scdTable } from './_helpers';
import { address } from './address';

export const taxes = snakeCase.table(
	'tax',
	{
		id: uuid().defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: varchar({ length: 10 }).notNull(),
		rate: numeric({ precision: 5, scale: 4, mode: 'number' }).notNull(),
	},
	t => [
		unique('uq_tax_user_name_rate').on(t.userId, t.name, t.rate),

		policy({
			role: authenticatedRole,
			select: authUid(t.userId),
			insert: authUid(t.userId),
			// Records should be immutable if referenced
			update: false,
			delete: authUid(t.userId),
		}),
	],
);

/** Join table for config and taxes */
export const configTaxes = snakeCase.table(
	'config_tax',
	{
		order: integer().notNull(),
		configId: uuid()
			.notNull()
			.references(() => config.id, { onDelete: 'cascade' }),
		taxId: uuid()
			.notNull()
			.references(() => taxes.id),

		userId: uuid()
			.notNull()
			.references(() => users.id),
	},
	t => [
		primaryKey({ name: 'pk_config_tax', columns: [t.configId, t.taxId] }),
		unique('uq_config_tax_order').on(t.configId, t.order),

		policy({
			role: authenticatedRole,
			select: authUid(t.userId),
			insert: authUid(t.userId),
			// Config taxes are fixed to their config
			update: false,
			delete: false,
		}),
	],
);

export const colorEnum = pgEnum('color', ['blue', 'grass', 'green', 'red', 'pink', 'lavender']);
export const numberingScheme = pgEnum('numbering_scheme', ['sequential', 'annual']);

//
//
//
// SCD v2
//
// Slowly changing dimension (SCD) — history table necessary for stable invoice references

export const config = scdTable(
	'config',
	{
		id: uuid().defaultRandom().primaryKey(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		tradingName: text().notNull(),
		email: encrypted(),
		phone: encrypted(),
		header: encrypted(),

		// The time zone of record, for invoice dates and yearly sequencing. This should eventually reference a table of time zones.
		timezone: text()
			.references(() => supportedTimezones.name)
			.notNull(),

		language: text().default('en').notNull(), // eg. `en`
		region: text(), // eg. `AU`
		locale: text()
			.generatedAlwaysAs(
				(): SQL => sql`${config.language} || COALESCE('-' || ${config.region}, '')`,
			)
			.notNull(),

		currency: char({ length: 3 })
			.references(() => currencies.iso)
			.notNull(),
		addressId: uuid().references(() => address.id),
		taxRegistration: boolean().notNull(),
		paymentDetails: encrypted().array(),
		registrationNumber: encrypted().array(),
		numberingScheme: numberingScheme().notNull(),
		colorScheme: colorEnum().notNull().default('blue'),
	},
	t => [
		// Ensure that a user has only one valid configuration (multiple null values will conflict)
		unique('uq_config_version').on(t.userId, t.validTo).nullsNotDistinct(),

		check('chk_language_lowercase', sql`${t.language} = lower(${t.language})`),
		check('chk_region_uppercase', sql`${t.region} = upper(${t.region})`),

		// Ensure config and address are owned by the same user
		foreignKey({
			name: 'fk_config_address_ownership',
			columns: [t.addressId, t.userId],
			foreignColumns: [address.id, address.userId],
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
