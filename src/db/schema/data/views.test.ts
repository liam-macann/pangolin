import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { type AnyPgColumn, PgNumericNumber } from 'drizzle-orm/pg-core';
import { assert, describe, expect } from 'vitest';

import { insertTestClient, insertTestConfig } from '@/lib/actions/tests/helpers';
import { withRLS } from '@/db';
import * as schema from '@/db/schema';

import { asUser as test } from '@/test/session';

/** Largest absolute value a Drizzle NUMERIC column can store, read off its own precision and scale */
function numericColumnBounds(column: AnyPgColumn<{ dataType: 'number' }>) {
	assert(
		column instanceof PgNumericNumber && typeof column.precision === 'number',
		'Expected a NUMERIC column with a declared precision',
	);
	const scale = column.scale ?? 0;
	return { maxValue: 10 ** (column.precision - scale) - 10 ** -scale };
}

const quantityBounds = numericColumnBounds(schema.lineItems.quantity);
const unitCostBounds = numericColumnBounds(schema.lineItems.unitCost);

/** Bypasses app-level validation to directly insert a config, a client, and invoice with items */
async function createTestInvoice({ items }: { items: { quantity: number; unitCost: number }[] }) {
	const configId = await insertTestConfig();

	return withRLS(async (db, session) => {
		const [document] = await db
			.insert(schema.documents)
			.values({
				userId: session.user.id,
				clientDataId: (await insertTestClient()).data.scdId,
				configId,
			})
			.returning({ id: schema.documents.id });

		const [invoice] = await db
			.insert(schema.invoices)
			.values({
				id: document.id,
				userId: session.user.id,
				issuedAt: new Date().toISOString(),
				dueAt: new Date().toISOString(),
				partition: null,
				index: 0,
			})
			.returning({ id: schema.invoices.id });

		await db
			.insert(schema.invoiceStatus)
			.values({ id: invoice.id, userId: session.user.id, status: 'unpaid' });

		await db.insert(schema.lineItems).values(
			items.map(item => ({
				id: randomUUID(),
				documentId: invoice.id,
				label: 'Item',
				quantity: item.quantity,
				unitCost: item.unitCost,
				configId,
				userId: session.user.id,
			})),
		);

		return invoice.id;
	});
}

describe('Invoice item numeric bounds', () => {
	test('netAmount does not overflow when quantity and unit cost are both at max', async () => {
		const invoiceId = await createTestInvoice({
			items: [{ quantity: quantityBounds.maxValue, unitCost: unitCostBounds.maxValue }],
		});

		const [item] = await withRLS(db =>
			db
				.select({ netAmount: schema.itemsWithTax.netAmount })
				.from(schema.itemsWithTax)
				.where(eq(schema.itemsWithTax.documentId, invoiceId)),
		);

		expect(item.netAmount).toBe(quantityBounds.maxValue * unitCostBounds.maxValue);
	});
});
