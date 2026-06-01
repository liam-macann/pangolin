import { type Column, type SQL, sql } from 'drizzle-orm';
import { customType, type PgEnum } from 'drizzle-orm/pg-core';

import { type Encrypted, isEncrypted, toHex } from '@/lib/utils/encrypt';

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

export const encrypted = customType<{
	data: Encrypted;
	driverData: Uint8Array | Buffer | string;
}>({
	dataType: () => 'bytea',
	toDriver(value: Encrypted): string {
		if (!isEncrypted(value)) throw new Error('Value is not encrypted');

		// Convert to Postgres hex format — safe to transport inside SQL param
		return `\\x${toHex(value)}`;
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
