import { type SQL, sql } from 'drizzle-orm';
import type { PgColumn, PgEnum } from 'drizzle-orm/pg-core';

/** Helper type to extract the TypeScript type from a PgColumn or SQL */
export type ColumnType<T> = T extends PgColumn<infer C>
	? C['notNull'] extends true
		? C['data']
		: C['data'] | null
	: T extends SQL<infer S>
		? S
		: never;

/** Derive type from PgEnum definition
 *
 * @example `type EnumType = Enum<typeof myEnum>;`
 */
// biome-ignore lint/suspicious/noExplicitAny: Conflict between mutability of type and return value. PgEnum type is stricter than structural check.
export type Enum<T extends PgEnum<any>> = T['enumValues'][number];

const _jsonbAgg = <T>(expression: SQL<T> | SQL.Aliased<T>) => sql<T[]>`jsonb_agg(${expression})`;

/** Pass a PgColumn to filter the aggregation where column is not null */
export function jsonbAgg<T>(expression: SQL<T> | SQL.Aliased<T>, filter?: PgColumn) {
	if (!filter) return _jsonbAgg(expression);

	return sql<T[]>`COALESCE(
        ${_jsonbAgg(expression)}
        FILTER (WHERE ${filter} IS NOT NULL),
        '[]'::jsonb
      )`;
}

/**
 * @param shape Potential for SQL injections, so you shouldn't allow user-specified key names
 */
export function jsonbBuildObject<T extends Record<string, PgColumn | SQL>>(shape: T) {
	const entries = Object.entries(shape).map(([key, value]) => sql`'${sql.raw(key)}', ${value}`);

	return sql<{
		[K in keyof T]: ColumnType<T[K]>;
	}>`jsonb_build_object(${sql.join(entries, sql.raw(', '))})`;
}
