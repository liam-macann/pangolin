import { eq } from 'drizzle-orm';
import { type AnyPgColumn, PgNumeric } from 'drizzle-orm/pg-core';
import { assert, describe, expect } from 'vitest';

import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { bypassRLS, asUser as test } from '@/test/session';

/** Largest absolute value a Drizzle NUMERIC column can store, read off its own precision and scale */
function numericColumnBounds(column: AnyPgColumn<{ dataType: 'number' | 'string numeric' }>) {
	assert(
		column instanceof PgNumeric && typeof column.precision === 'number',
		'Expected a NUMERIC column with a declared precision',
	);
	const scale = column.scale ?? 0;
	return { maxValue: 10 ** (column.precision - scale) - 10 ** -scale };
}

const quantityBounds = numericColumnBounds(tables.lineItems.quantity);
const unitCostBounds = numericColumnBounds(tables.lineItems.unitCost);

describe('Invoice item numeric bounds', () => {
	test('netAmount does not overflow when quantity and cost are maximum', async ({ db, seed }) => {
		const [invoice] = await seed.invoices({ count: 1 });

		await bypassRLS(() =>
			db
				.update(tables.lineItems)
				.set({
					quantity: `${quantityBounds.maxValue}`,
					unitCost: `${unitCostBounds.maxValue}`,
				})
				.where(eq(tables.lineItems.documentId, invoice.id)),
		);

		const [item] = await withRLS(db =>
			db
				.select({ netAmount: tables.itemsWithTax.netAmount })
				.from(tables.itemsWithTax)
				.where(eq(tables.itemsWithTax.documentId, invoice.id)),
		);

		const expected = (quantityBounds.maxValue * unitCostBounds.maxValue).toFixed(4);
		expect(item.netAmount).toEqual(expected);
	});
});
