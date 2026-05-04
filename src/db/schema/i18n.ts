import { boolean, char, interval, pgView, smallint, snakeCase, text } from 'drizzle-orm/pg-core';

import { policy } from './data/_helpers';

/** Seeded from ISO 4217 list of currencies and currency codes */
export const currencies = snakeCase.table(
	'currency',
	{
		iso: char({ length: 3 }).primaryKey(),
		/** Human readable currency name */
		name: text('name').notNull(),
		isActive: boolean('is_active').default(true).notNull(),
		minorUnit: smallint('minor_unit'),
	},
	() => [
		policy({
			select: true,
			insert: false,
			update: false,
			delete: false,
		}),
	],
);

/** System view with live timezone data */
export const timezones = pgView('pg_timezone_names', {
	name: text('name').notNull(),
	abbrev: text('abbrev'),
	utcOffset: interval('utc_offset'),
	isDst: boolean('is_dst'),
}).existing();

/** Enforces FK in config record */
export const supportedTimezones = snakeCase.table(
	'timezone',
	{
		name: text('name').primaryKey(),
	},
	() => [
		policy({
			select: true,
			insert: false,
			update: false,
			delete: false,
		}),
	],
);
