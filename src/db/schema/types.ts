import { type Column } from 'drizzle-orm';
import { type AnyPgColumn, customType, PgCustomColumn } from 'drizzle-orm/pg-core';

/** Text with deterministic Unicode collation, backed by a custom PostgreSQL unicode_text domain. */
export const unicode = customType<{ data: string; driverData: string }>({
	dataType: () => 'unicode_text',
});

export type UnicodeColumn = AnyPgColumn<
	Pick<ReturnType<typeof unicode>['_'], 'data' | 'dataType' | 'driverParam'>
>;

/** Recognizes the Unicode domain when inspecting columns with erased data types. */
export const isUnicode = (column: Column): column is UnicodeColumn =>
	column instanceof PgCustomColumn && column.getSQLType() === 'unicode_text';
