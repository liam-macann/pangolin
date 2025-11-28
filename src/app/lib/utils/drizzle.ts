import { type Column, type SQL, sql } from 'drizzle-orm';
import type { PgEnum } from 'drizzle-orm/pg-core';
import type { Prettify } from './index';

type AnySql = SQL | Column | SQL.Aliased;

/** Helper type to extract the TypeScript type from a PgColumn or SQL */
export type ColumnType<T> = T extends Column<infer C>
	? C['notNull'] extends true
		? C['data']
		: C['data'] | null
	: T extends SQL<infer S>
		? S
		: T extends SQL.Aliased<infer A>
			? A
			: never;

/** Derive type from PgEnum definition
 *
 * @example `type EnumType = Enum<typeof myEnum>;`
 */
// biome-ignore lint/suspicious/noExplicitAny: Conflict between mutability of type and return value. PgEnum type is stricter than structural check.
export type Enum<T extends PgEnum<any>> = T['enumValues'][number];

const _jsonbAgg = <T>(expression: SQL<T> | SQL.Aliased<T>) => sql<T[]>`jsonb_agg(${expression})`;

/** Pass a PgColumn to filter the aggregation where column is not null */
export function jsonbAgg<T>(expression: SQL<T> | SQL.Aliased<T>, filter?: SQL, order?: SQL) {
	if (!filter) return _jsonbAgg(expression);

	const query = sql<T[]>`COALESCE(
        ${_jsonbAgg(expression)}`;

	if (filter) query.append(sql` FILTER (WHERE ${filter})`);
	if (order) query.append(sql` ORDER BY ${order}`);

	query.append(sql`,
        '[]'::jsonb
      )`);

	return query;
}

/**
 * @param shape Potential for SQL injections, so you shouldn't allow user-specified key names
 */
export function jsonbBuildObject<T extends Record<string, AnySql>>(shape: T) {
	const entries = Object.entries(shape).map(([key, value]) => sql`'${sql.raw(key)}', ${value}`);

	return sql<{
		[K in keyof T]: ColumnType<T[K]>;
	}>`jsonb_build_object(${sql.join(entries, sql.raw(', '))})`;
}

/**
 * Appends a SQL "FILTER (WHERE ...)" clause to an aggregate function.
 * @param aggregate - The aggregate function: `sum(col)`, `count(col)`
 * @param condition - The filter condition: `eq(col, 1)`
 */
export const withFilter = <T>(aggregate: SQL<T>, condition: SQL) =>
	sql<T>`${aggregate} filter (where ${condition})`;

// type ExtractSqlType<S> = S extends SQL<infer T>
// 	? T
// 	: S extends Column
// 		? GetColumnData<S, 'query'>
// 		: never;

type Coalesce<Array extends SqlOrPrimitive[]> = Array extends [...infer Optionals, infer Last]
	? Exclude<ColumnType<Optionals[number]>, null | undefined> | ColumnType<Last>
	: never;

type SqlOrPrimitive = AnySql | string | number | boolean;

export function coalesce<Args extends [SqlOrPrimitive, SqlOrPrimitive, ...SqlOrPrimitive[]]>(
	...args: Args
) {
	return sql<Coalesce<Args>>`coalesce(${sql.join(
		args.map(a => (typeof a === 'string' ? sql`'${a}'` : sql`${a}`) as AnySql),
		sql.raw(','),
	)})`;
}

import { type ColumnsSelection, is, type Subquery, Table, View, ViewBaseConfig } from 'drizzle-orm';
import type { AnyMySqlSelect } from 'drizzle-orm/mysql-core';
import type { AnyPgSelect } from 'drizzle-orm/pg-core';
import type { AnySQLiteSelect } from 'drizzle-orm/sqlite-core';
import type { WithSubquery } from 'drizzle-orm/subquery';

// See https://github.com/drizzle-team/drizzle-orm/pull/1789
type Select = AnyPgSelect | AnyMySqlSelect | AnySQLiteSelect;
type AnySelect = Prettify<Omit<Select, 'where'> & Partial<Pick<Select, 'where'>>>;

/**
 * Get the columns of a table, view, subquery, or select.
 * @remarks This has already been merged into beta. Temporary utility.
 */
export function getColumns<
	T extends
		| Table
		| View
		| Subquery<string, ColumnsSelection>
		| WithSubquery<string, ColumnsSelection>
		| AnySelect,
>(
	table: T,
): T extends Table
	? T['_']['columns']
	: T extends View | Subquery | WithSubquery | AnySelect
		? T['_']['selectedFields']
		: never {
	return is(table, Table)
		? (table as any)[(Table as any).Symbol.Columns]
		: is(table, View)
			? (table as any)[ViewBaseConfig].selectedFields
			: table._.selectedFields;
}
