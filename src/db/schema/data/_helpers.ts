import { timestamp } from 'drizzle-orm/pg-core';

//
//
//
// SCD v2
//
// Slowly changing dimension (SCD) — history table necessary for stable invoice references

export const scdDates = {
	validFrom: timestamp('valid_from', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	validTo: timestamp('valid_to', { withTimezone: true, mode: 'date' }),
};
