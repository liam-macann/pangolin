import { getTableName, type RelationsFilter, type SQL, sql } from 'drizzle-orm';
import { type AnyPgColumn, type PgTable } from 'drizzle-orm/pg-core';

import { array } from '@/lib/utils/drizzle';
import { type relations } from '@/db/relations';

import { after, type Field, type Key, orderBy } from './boundary';
import { type Cursor, encode, parse, SortValues } from './cursor';
import { type Sort, sortParam } from './sort';

/** A table whose unique `id` column breaks ties between rows that sort equally. */
type KeysetTable = PgTable & { id: AnyPgColumn };

type Schema = typeof relations;

/** Relational query filter for a table. */
type FilterFor<TTable> = RelationsFilter<Extract<Schema[keyof Schema], { table: TTable }>, Schema>;

/** A sort field: one expression, or several where each later one orders the ties of the last, in the same direction. */
type SortField<TTable> = Field<TTable> | readonly [Field<TTable>, ...Field<TTable>[]];

type PageOptions<TFields> = {
	/** Opaque cursor holding the sort values of the last item of the previous page.
	 * @remarks Bound to the table and sort it was minted under, but not to the filters. */
	cursor: Cursor | undefined;

	/** Number of items requested in a page. */
	limit: number;

	/** Fields to sort by, most significant first.
	 * @remarks The row id is appended as a tiebreaker, in the direction of the last field. */
	sort: Sort<keyof TFields>;
};

/** Declare the fields a list can be sorted by, to fetch it in keyset-paginated pages.
 * @param table Table the fields are read from, which forms a scope for the cursor.
 * @param fields Sort field expressions, named as the caller refers to them. */
export function defineKeyset<
	TTable extends KeysetTable,
	TFields extends Record<string, SortField<TTable>>,
>(table: TTable, fields: TFields) {
	const ctx = { table: getTableName(table) };

	const isField = (name: string): name is Extract<keyof TFields, string> =>
		Object.hasOwn(fields, name);

	/** Normalizes array and direct SortField form. */
	const expressions = (field: SortField<TTable>) => (typeof field === 'function' ? [field] : field);

	return {
		sortParam: sortParam(Object.keys(fields).filter(isField)),

		/** Resolve what a fetcher applies to fetch one page, and how its rows become the result. */
		page({ cursor, limit, sort }: PageOptions<TFields>) {
			const requestedKeys = Object.entries(sort).flatMap(([name, direction]) =>
				direction ? expressions(fields[name]).map(sql => ({ sql, direction })) : [],
			);

			const keys: Key<TTable>[] = [
				...requestedKeys,
				// Adds a deterministic tiebreaker
				{ sql: row => row.id, direction: requestedKeys.at(-1)?.direction ?? 'asc' },
			];

			const position = parse(cursor, sort, ctx);

			return {
				/** Narrow a filter to the rows after the cursor; unchanged on the first page. */
				where: (filter: FilterFor<TTable>) =>
					position ? { AND: [filter, { RAW: after(keys, position.values) }] } : filter,

				/** Fields for the fetcher to select alongside each row, from which the cursor is minted. */
				extras: {
					// Read as text to round-trip through a cursor without precision loss
					sortValues: (row: TTable): SQL<SortValues> =>
						array(keys.map(key => sql`(${key.sql(row)})::text`)),
				},

				/** Overfetches by one row, used to determine whether there are more pages. */
				limit: limit + 1,

				orderBy: orderBy(keys),

				/** Trim fetched rows to the requested page, minting a cursor when more follow.
				 * @remarks Rows must carry the `extras` selected with them, which are removed from the page. */
				result<TRow extends object>(rows: (TRow & { sortValues?: unknown })[]) {
					const kept = rows.slice(0, limit);
					const data = kept.map(({ sortValues, ...row }) => row);

					const next = rows.length > limit ? kept.at(-1) : undefined;
					const values = next && SortValues.length(keys.length).safeParse(next.sortValues);
					if (values && !values.success) throw new Error('Fetched rows are missing extra columns');

					const nextCursor = values ? encode({ sort, values: values.data }, ctx) : null;
					return { data, meta: { limit, nextCursor } };
				},
			};
		},
	};
}
