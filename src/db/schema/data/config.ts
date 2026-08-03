import { isNull, type SQL, sql } from 'drizzle-orm';
import {
	boolean,
	char,
	check,
	index,
	integer,
	numeric,
	pgEnum,
	primaryKey,
	snakeCase,
	text,
	unique,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

import { encrypted } from '@/lib/utils/drizzle';
import { users } from '@/db/schema/auth';
import { currencies, supportedTimezones } from '@/db/schema/i18n';

import { authUid, policy, relationOwnership, scdTable } from './_helpers';
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
		// Eliminate redundant storage (force application to reuse identical rows)
		unique('uq_tax_user_name_rate').on(t.userId, t.name, t.rate),

		policy({
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
		/** Order used to define in what sequence taxes are printed on invoice */
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

		// Unique constraint ensures sorting by order produces predictable result
		unique('uq_config_tax_order').on(t.configId, t.order),

		index('idx_config_tax_tax_id').on(t.taxId),
		index('idx_config_tax_user_id').on(t.userId),

		policy({
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
		region: text().notNull(), // eg. `AU`
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
		tradingNumber: encrypted().array(),
		numberingScheme: numberingScheme().notNull(),
		colorScheme: colorEnum().notNull().default('blue'),
	},
	t => [
		// Ensure that a user has only one valid configuration (multiple null values will conflict)
		uniqueIndex('uq_config_active_version').on(t.userId).where(isNull(t.validTo)),

		// Necessary for ownership constraint on invoices
		unique('uq_config_user').on(t.id, t.userId),

		index('idx_config_user_id').on(t.userId),
		index('idx_config_address_id').on(t.addressId),

		check('chk_language_lowercase', sql`${t.language} = lower(${t.language})`),
		check('chk_region_uppercase', sql`${t.region} = upper(${t.region})`),

		// Ensure config and address are owned by the same user
		relationOwnership(t.addressId, address),

		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			update: false,
			delete: authUid(t.userId),
		}),
	],
);
