import { Column, is, type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, lt, lte, or } from 'drizzle-orm/sql';

import { type SortValues } from './cursor';
import { type Direction } from './sort';

/** How to read a sort field value from a row of the table. */
export type Field<TTable> = (table: TTable) => SQLWrapper;

/** One key of a lexicographic order: a field, in a direction. */
export type Key<TTable> = { sql: Field<TTable>; direction: Direction };

/** A sort value as a cursor carries it: its text form, which Postgres casts back to the field type. */
type CursorValue = SortValues[number];

/** Whether the row value for a key ties with the cursor value, where nulls are equivalent. */
const ties = (expr: SQLWrapper, value: CursorValue) =>
	value === null ? isNull(expr) : eq(expr, sql.param(value));

/** Does this row come after the cursor, in the direction of this key? */
const follows = (direction: Direction, expr: SQLWrapper, value: CursorValue) => {
	// Null is treated as the largest value (last ASC and first DESC), as Postgres defaults to
	if (value === null) return direction === 'asc' ? sql`false` : isNotNull(expr);

	// Values are bound as plain params, so Postgres casts them, rather than a column encoding
	return direction === 'asc'
		? or(gt(expr, sql.param(value)), isNull(expr))
		: lt(expr, sql.param(value));
};

/** Order rows by each key in turn. */
export const orderBy =
	<TTable>(keys: Key<TTable>[]) =>
	(row: TTable): SQL[] =>
		keys.map(key => (key.direction === 'asc' ? asc : desc)(key.sql(row)));

/** Uses the first sort key from several, producing an inclusive bound from the cursor value. */
const leadingBound = <TTable>(row: TTable, [key, ...later]: Key<TTable>[], [value]: SortValues) => {
	const expr = key.sql(row);

	// We can't index an expression referencing another table (e.g. a subquery)
	if (!later.length || !is(expr, Column)) return undefined;

	// NULL is treated as the largest value, so its position changes with direction
	// If the column could be null, this optimization would exclude null values
	if (!expr.notNull || value === null) return undefined;

	const operator = key.direction === 'asc' ? gte : lte;
	return operator(expr, sql.param(value));
};

/** Whether a row is ordered after the cursor.
 * @remarks A row follows when it ties on every key before one, and is ordered after the cursor on that one. */
export const after =
	<TTable>(keys: Key<TTable>[], values: SortValues) =>
	(row: TTable): SQL => {
		const firstCondition = leadingBound(row, keys, values);
		const allConditions =
			keys.reduceRight<SQL | undefined>((later, key, i) => {
				const expr = key.sql(row); // DB row
				const value = values[i] ?? null; // Cursor value
				const advances = follows(key.direction, expr, value);

				// Advance on this key, or tie on it and advance on a later one
				return later ? or(advances, and(ties(expr, value), later)) : advances;
			}, undefined) ?? sql`false`;

		// Separating first condition (with AND) allows database to immediately seek to cursor on indexed columns
		// Implied by allConditions, so results are unchanged
		return and(firstCondition, allConditions) ?? allConditions;
	};
