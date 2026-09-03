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
	customType,
	getTableConfig,
	type PgChar,
	PgDialect,
	type PgEnum,
	type PgText,
	type PgVarchar,
} from 'drizzle-orm/pg-core';

import { type Encrypted, isEncrypted, toBytes, toHex } from '@/lib/utils/encrypt';

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

export const encrypted = customType<{
	data: Encrypted;
	driverData: Uint8Array | Buffer | string;
}>({
	dataType: () => 'bytea',
	toDriver(value: Encrypted): Buffer {
		if (!isEncrypted(value)) throw new Error('Value is not encrypted');

		// Buffer necessary to support both Neon driver and PGLite
		return Buffer.from(toBytes(value));
	},
	fromDriver(value): Encrypted<string> {
		// Conservatively handle DB driver behaviour with union type
		const bytes = ((): Uint8Array => {
			if (value instanceof Uint8Array) return value;

			// If returned as Buffer
			if (Buffer.isBuffer(value)) return new Uint8Array(value);

			// If hex encoded string
			if (!value.startsWith('\\x')) throw new Error('String is not hex encoded');

			return new Uint8Array(Buffer.from(value.slice(2), 'hex'));
		})();

		if (!isEncrypted(bytes)) throw new Error('Value is missing encryption header');

		return toHex(bytes);
	},
});

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
