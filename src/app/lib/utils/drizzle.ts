import { type SQL, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/** Helper type to extract the TypeScript type from a PgColumn or SQL */
export type ColumnType<T> = T extends PgColumn<infer C>
	? C['data']
	: T extends SQL<infer S>
		? S
		: never;

function _jsonbAgg<T>(expression: SQL<T> | SQL.Aliased<T>) {
	return sql<T[]>`jsonb_agg(${expression})`;
}

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
