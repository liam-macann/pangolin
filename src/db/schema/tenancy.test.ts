import { getTableName, is } from 'drizzle-orm';
import { getTableConfig, getViewConfig, isPgView, type PgTable, PgUUID } from 'drizzle-orm/pg-core';
import { assert, describe, expect, test } from 'vitest';

import * as schema from '@/db/schema';

import { foreignKeys, tables } from './tests/helpers';

describe('Cross-tenant ownership constraints', () => {
	/** Tables that include a `user_id` column, and therefore scope rows to a tenant */
	const isOwned = (table: PgTable) =>
		getTableConfig(table).columns.some(
			col => col.name === 'user_id' && is(col, PgUUID) && col.notNull,
		);

	/** Simple FKs between two owned tables, excluding the `user_id → users.id` link itself */
	const candidateEdges = foreignKeys.filter(
		({ table, foreignTable, mapping, columns }) =>
			columns.length === 1 && !mapping.has('user_id') && isOwned(table) && isOwned(foreignTable),
	);

	const getUniqueColumnSets = (table: PgTable) => {
		const config = getTableConfig(table);

		return [
			...config.columns.filter(column => column.primary).map(column => [column]),
			...config.primaryKeys.map(primaryKey => primaryKey.columns),
			...config.uniqueConstraints.map(uniqueConstraint => uniqueConstraint.columns),
			...config.indexes
				.filter(index => index.config.unique && !index.config.where)
				.map(index => index.config.columns),
		];
	};

	const hasUniqueColumns = (table: PgTable, columnNames: string[]) =>
		getUniqueColumnSets(table).some(
			columns =>
				columns.length === columnNames.length &&
				columns.every((column, index) => 'name' in column && column.name === columnNames[index]),
		);

	const hasForeignKey = (
		source: PgTable,
		target: PgTable,
		mappings: [source: string, target: string][],
	) =>
		foreignKeys.some(fk => {
			if (fk.table !== source || fk.foreignTable !== target) return false;
			if (fk.columns.length !== 2) return false;

			return [['user_id', 'user_id'], ...mappings].every(
				([column, refColumn]) => fk.mapping.get(column) === refColumn,
			);
		});

	/** Renders a foreign key as `source_table.column → target_table.column` */
	const relationLabel = (fk: (typeof foreignKeys)[number]) =>
		`${getTableName(fk.table)}.${fk.columns[0].name} → ` +
		`${getTableName(fk.foreignTable)}.${fk.foreignColumns[0].name}`;

	test.for(
		candidateEdges.map(
			edge => [`${getTableName(edge.table)} → ${getTableName(edge.foreignTable)}`, edge] as const,
		),
	)('%s', ([_, edge]) => {
		const [[column, refColumn]] = edge.mapping;

		// This is true when a table directly owns a composite foreign key that references user_id
		const hasDirectComposite = hasForeignKey(edge.table, edge.foreignTable, [[column, refColumn]]);

		// This is true in a 1:1 relationship where the target table owns a composite foreign key that references user_id
		const hasReciprocalComposite =
			hasUniqueColumns(edge.table, [column]) &&
			hasUniqueColumns(edge.table, [column, 'user_id']) &&
			hasForeignKey(edge.foreignTable, edge.table, [[refColumn, column]]);

		const isCovered = hasDirectComposite || hasReciprocalComposite;

		assert(
			isCovered,
			`Cross-tenant leak hazard: no same-direction or reciprocal composite FK enforces ownership between [${relationLabel(edge)}]`,
		);

		// A reciprocal FK proves ownership only for a one-to-one relation. Its source
		// column must be unique; otherwise another source row could reference the same target.
		if (!hasDirectComposite) return;

		// Postgres relies a unique constraint on the target table to enforce the composite FK
		const hasCompositeUniqueOnTarget =
			hasUniqueColumns(edge.foreignTable, [refColumn, 'user_id']) ||
			hasUniqueColumns(edge.foreignTable, ['user_id', refColumn]);

		assert(
			hasCompositeUniqueOnTarget,
			`Target table [${getTableName(edge.foreignTable)}] lacks a UNIQUE constraint or PK on (user_id, ${refColumn}) required to satisfy composite FK reference.`,
		);
	});
});

describe('RLS policies', () => {
	// All tables must have an RLS policy
	test.for(tables)('$name has an RLS policy', t => expect(t.policies.length).toBeGreaterThan(0));

	// All views must have securityInvoker and securityBarrier enabled, and therefore respect underlying RLS policies
	describe('View security options', () => {
		/** User-defined views only: excludes `.existing()` views (eg. system catalogs) */
		const views = Object.values(schema)
			.filter(value => isPgView(value))
			.filter(view => !getViewConfig(view).isExisting)
			.map(view => getViewConfig(view));

		test.for(views)('$name is declared with securityInvoker and securityBarrier', view => {
			expect(view.with?.securityInvoker).toBe(true);
			expect(view.with?.securityBarrier).toBe(true);
		});
	});
});
