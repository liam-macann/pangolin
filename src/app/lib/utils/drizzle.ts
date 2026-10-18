import {
	type Column,
	type DBQueryConfigOrderBy,
	type DBQueryConfigOrderByCallback,
	type FieldSelection,
	getColumnTable,
	relationsOrderToSQL,
	type SchemaEntry,
	type SQL,
	sql,
} from 'drizzle-orm';
import {
	getTableConfig,
	type PgChar,
	PgDialect,
	type PgEnum,
	type PgNumeric,
	type PgText,
	type PgVarchar,
} from 'drizzle-orm/pg-core';

type AnySql = SQL | Column | SQL.Aliased;

/** Helper type to extract the TypeScript type from a PgColumn or SQL */
export type ColumnType<T> =
	T extends Column<infer C>
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

/** Pass a PgColumn to filter the aggregation where column is not null
 * @remarks ORDER BY belongs inside the aggregate's parentheses; FILTER follows them. */
export function jsonbAgg<T>(expression: SQL<T> | SQL.Aliased<T>, filter?: SQL, order?: SQL) {
	const aggregate = sql<T[]>`jsonb_agg(${expression}`;
	if (order) aggregate.append(sql` ORDER BY ${order}`);
	aggregate.append(sql`)`);

	if (!filter) return aggregate;

	return sql<T[]>`COALESCE(${aggregate} FILTER (WHERE ${filter}), '[]'::jsonb)`;
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

/** Combines expressions of one type into a Postgres array. */
export const array = <T>(exprs: SQL<T>[]): SQL<T[]> => {
	if (exprs.length === 0) throw new Error('A SQL array requires at least one expression');
	return sql`array[${sql.join(exprs, sql`, `)}]`;
};

/**
 * Appends a SQL "FILTER (WHERE ...)" clause to an aggregate function.
 * @param aggregate - The aggregate function: `sum(col)`, `count(col)`
 * @param condition - The filter condition: `eq(col, 1)`
 */
export const withFilter = <T>(aggregate: SQL<T>, condition: SQL) =>
	sql<T>`${aggregate} filter (where ${condition})`;

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

/** Accepts an arbitrary number of orderBy parameters, and returns a merged orderBy callback
 * @remarks Earlier arguments take precedence, as order is preserved in the SQL query
 */
export function mergeOrderBy<TTable extends SchemaEntry, TColumns extends FieldSelection>(
	...orderBys: Array<DBQueryConfigOrderBy<TTable, TColumns> | undefined>
): DBQueryConfigOrderByCallback<TTable> {
	return (table, operators) => {
		return orderBys.flatMap(orderBy => {
			if (!orderBy) return [];

			const resolved =
				typeof orderBy === 'function'
					? orderBy(table, operators)
					: relationsOrderToSQL(table, orderBy);

			return resolved ?? [];
		});
	};
}

const dialect = new PgDialect();

/** Reads length bounds of a string column, from either type (VARCHAR, CHAR) or check constraints */
export const getTextColumnBounds = (column: PgChar | PgText | PgVarchar) => {
	const checks = getTableConfig(getColumnTable(column)).checks;

	// In Postgres, all three are equivalent
	const functions = [
		dialect.sqlToQuery(sql`char_length(${column})`).sql,
		dialect.sqlToQuery(sql`character_length(${column})`).sql,
		dialect.sqlToQuery(sql`length(${column})`).sql,
	];

	return checks
		.flatMap(check => {
			const sql = dialect.sqlToQuery(check.value).sql;
			const prefix = functions.find(prefix => sql.startsWith(prefix));
			if (!prefix) return [];

			const match = sql.slice(prefix.length).match(/^\s*(<=|>=|=)\s*(\d+)$/);
			if (!match) return [];

			const operator = match[1];
			const length = Number(match[2]);

			if (operator === '<=') return [{ minLength: 0, maxLength: length }];
			if (operator === '>=') return [{ minLength: length, maxLength: Infinity }];
			return [{ minLength: length, maxLength: length }];
		})
		.reduce(
			(acc, check) => ({
				minLength: Math.max(acc.minLength, check.minLength),
				maxLength: Math.min(acc.maxLength, check.maxLength),
			}),
			// CHAR length does not impose minimum, but rather pads input to length
			{ minLength: 0, maxLength: column.length ?? Infinity },
		);
};

export const getNumericColumnPrecision = (column: PgNumeric) => {
	if (typeof column.precision !== 'number') return undefined;
	return { precision: column.precision, scale: column.scale ?? 0 };
};
