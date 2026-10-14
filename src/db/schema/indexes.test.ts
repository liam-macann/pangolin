import { asc, desc, eq, getTableName, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { assert, describe, expect, test } from 'vitest';

import * as tables from '@/db/schema';

import { asUser } from '@/test/session';

import { foreignKeys } from './tests/helpers';

const columnName = (value: unknown) =>
	typeof value === 'object' && value !== null && 'name' in value ? value.name : undefined;

describe('Foreign key indexes', () => {
	const isIndexed = (fk: (typeof foreignKeys)[number]) => {
		const config = getTableConfig(fk.table);

		return [
			...config.columns.filter(column => column.primary).map(column => [column]),
			...config.primaryKeys.map(key => key.columns),
			...config.uniqueConstraints.map(constraint => constraint.columns),
			...config.indexes.map(index => index.config.columns),
		].some(([column]) => columnName(column) === fk.columns[0].name);
	};

	test.for(
		foreignKeys
			.filter(({ columns }) => columns.length === 1)
			.map(fk => [`${getTableName(fk.table)}.${fk.columns[0].name}`, fk] as const),
	)("FK '%s' is indexed", ([label, fk]) => assert(isIndexed(fk), `${label} is not indexed`));
});

describe('Sort indexes', () => {
	// Ordered as a keyset page orders them, with the id breaking ties in the same direction
	asUser.for([
		['newest', desc],
		['oldest', asc],
	] as const)('Lists invoices %s first from an index', async ([, direction], { db, session }) => {
		const { invoices } = tables;

		// Small tables favour a scan and sort, so rule both out unless an index can't serve the order
		await db.execute(sql`SET LOCAL enable_seqscan = off`);
		await db.execute(sql`SET LOCAL enable_sort = off`);

		const query = db
			.select({ id: invoices.id })
			.from(invoices)
			.where(eq(invoices.userId, session.user.id))
			.orderBy(direction(invoices.issuedAt), direction(invoices.id))
			.limit(201);

		const { rows } = await db.execute<{ 'QUERY PLAN': string }>(sql`EXPLAIN ${query}`);
		const plan = rows.map(row => row['QUERY PLAN']).join('\n');

		expect(plan).toContain('idx_invoice_user_issued_at_id');
		expect(plan).not.toMatch(/\bSort\b/);
	});
});
