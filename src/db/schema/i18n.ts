import { boolean, char, interval, pgTable, pgView, smallint, text } from 'drizzle-orm/pg-core';

/** Seeded from ISO 4217 list of currencies and currency codes */
export const currencies = pgTable('currency', {
	iso: char({ length: 3 }).primaryKey(),
	/** Human readable currency name */
	name: text('name').notNull(),
	isActive: boolean('is_active').default(true).notNull(),
	minorUnit: smallint('minor_unit'),
});

/** System view with live timezone data */
export const timezones = pgView('pg_timezone_names', {
	name: text('name').notNull(),
	abbrev: text('abbrev'),
	utcOffset: interval('utc_offset'),
	isDst: boolean('is_dst'),
}).existing();

/** Enforces FK in config record */
export const supportedTimezones = pgTable('timezone', {
	name: text('name').primaryKey(),
});
