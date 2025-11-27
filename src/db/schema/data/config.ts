import {
	boolean,
	integer,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	unique,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

// Schema imports
import { users } from '../auth';
import { scdDates } from './_helpers';

// Records should be immutable if referenced
export const taxes = pgTable('tax', {
	id: uuid().defaultRandom().primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: varchar({ length: 10 }).notNull(),
	rate: numeric({ precision: 5, scale: 4, mode: 'number' }).notNull(),
});

/** Join table for invoice items and taxes */
export const configTaxes = pgTable(
	'config_tax',
	{
		order: integer().notNull(),
		configId: uuid('config_id')
			.notNull()
			.references(() => config.id, { onDelete: 'cascade' }),
		taxId: uuid('tax_id')
			.notNull()
			.references(() => taxes.id),
	},
	t => [
		primaryKey({ name: 'config_tax_pkey', columns: [t.configId, t.taxId] }),
		unique('uq_config_tax_order').on(t.configId, t.order),
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

export const config = pgTable(
	'config',
	{
		id: uuid().defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		// The time zone of record, for invoice dates and yearly sequencing. This should eventually reference a table of time zones.
		timezone: text().notNull(),
		locale: text().notNull(),
		currency: varchar('currency', { length: 3 }).notNull(),
		taxRegistration: boolean('tax_registration').notNull(),
		numberingScheme: numberingScheme('numbering_scheme').notNull(),
		colorScheme: colorEnum('color_scheme').notNull().default('blue'),
		...scdDates,
	},
	t => [
		// Ensure that a user has only one valid configuration (multiple null values will conflict)
		unique('config_version').on(t.userId, t.validTo),
	],
);
