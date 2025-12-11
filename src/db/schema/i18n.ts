import { boolean, char, pgTable, smallint, text } from 'drizzle-orm/pg-core';

export const currencies = pgTable('currency', {
	iso: char({ length: 3 }).primaryKey(),
	/** Human readable currency name */
	name: text('name').notNull(),
	isActive: boolean('is_active').default(true).notNull(),
	minorUnit: smallint('minor_unit'),
});
