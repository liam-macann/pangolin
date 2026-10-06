import { eq, sql } from 'drizzle-orm';
import { describe, expect } from 'vitest';
import { z } from 'zod';

import { voidInvoice } from '@/lib/actions/invoice';
import {
	insertTestConfig,
	insertTestInvoice,
	setUpConfigAndClient,
} from '@/lib/actions/tests/fixtures';
import { type Enum } from '@/lib/utils/drizzle';
import { invoice as invoiceSchema } from '@/lib/validation/invoice';
import { getBounds } from '@/lib/zod';
import * as tables from '@/db/schema';

import { type TestTX } from '@/test/pglite';
import { asUser as test } from '@/test/session';

import { fetchStats } from './stats';

type Item = { quantity: number; unitCost: number };

const isNumber = (schema: z.core.$ZodType): schema is z.core.$ZodNumber | z.core.$ZodNumberFormat =>
	schema instanceof z.ZodNumber || schema instanceof z.ZodNumberFormat;

const quantityBounds = getBounds(invoiceSchema.shape.items.element.shape.quantity, isNumber, {
	minimum: -Infinity,
});
const unitCostBounds = getBounds(invoiceSchema.shape.items.element.shape.unitCost, isNumber, {
	minimum: -Infinity,
});

describe('fetchStats', () => {
	type InvoiceCase = { items: Item[]; status: Enum<typeof tables.statusEnum>; void?: boolean };
	type ExpectedStats = {
		validCount: number;
		netSum: number;
		grossSum: number;
		grossOutstanding: number;
	};

	/** Creates each invoice in sequence (voiding it afterwards, when requested) */
	async function seedInvoices(clientDataId: string, invoices: InvoiceCase[]) {
		for (const invoice of invoices) {
			const id = await insertTestInvoice({
				clientDataId,
				items: invoice.items,
				status: invoice.status,
			});
			if (invoice.void) await voidInvoice(id);
		}
	}

	test.for<[string, { invoices: InvoiceCase[]; expected: ExpectedStats }]>([
		[
			'coinciding totals',
			{
				invoices: [
					{ items: [{ quantity: 1, unitCost: 100 }], status: 'unpaid' },
					{ items: [{ quantity: 1, unitCost: 100 }], status: 'unpaid' },
				],
				expected: { validCount: 2, netSum: 200, grossSum: 200, grossOutstanding: 200 },
			},
		],
		[
			'fractional totals',
			{
				invoices: [
					{ items: [{ quantity: 1, unitCost: 33.33 }], status: 'unpaid' },
					{ items: [{ quantity: 1, unitCost: 66.67 }], status: 'unpaid' },
				],
				expected: { validCount: 2, netSum: 100, grossSum: 100, grossOutstanding: 100 },
			},
		],
		[
			'negative total (credit note)',
			{
				invoices: [
					{ items: [{ quantity: 1, unitCost: 100 }], status: 'unpaid' },
					{ items: [{ quantity: 1, unitCost: -40 }], status: 'unpaid' },
				],
				expected: { validCount: 2, netSum: 60, grossSum: 60, grossOutstanding: 60 },
			},
		],
		[
			'zero-total invoice',
			{
				invoices: [
					{ items: [{ quantity: 0, unitCost: 100 }], status: 'unpaid' },
					{ items: [{ quantity: 1, unitCost: 50 }], status: 'unpaid' },
				],
				expected: { validCount: 2, netSum: 50, grossSum: 50, grossOutstanding: 50 },
			},
		],
		[
			'refunded invoice',
			{
				invoices: [
					{ items: [{ quantity: 1, unitCost: 100 }], status: 'refunded' },
					{ items: [{ quantity: 1, unitCost: 50 }], status: 'unpaid' },
				],
				expected: { validCount: 2, netSum: 50, grossSum: 50, grossOutstanding: 50 },
			},
		],
		[
			'paid invoice',
			{
				invoices: [
					{ items: [{ quantity: 1, unitCost: 100 }], status: 'paid' },
					{ items: [{ quantity: 1, unitCost: 50 }], status: 'unpaid' },
				],
				expected: { validCount: 2, netSum: 150, grossSum: 150, grossOutstanding: 50 },
			},
		],
		[
			'voided invoice',
			{
				invoices: [
					{ items: [{ quantity: 1, unitCost: 100 }], status: 'unpaid', void: true },
					{ items: [{ quantity: 1, unitCost: 50 }], status: 'unpaid' },
				],
				expected: { validCount: 1, netSum: 50, grossSum: 50, grossOutstanding: 50 },
			},
		],
		[
			'max total',
			{
				invoices: [
					{
						items: [{ quantity: quantityBounds.maximum, unitCost: unitCostBounds.maximum }],
						status: 'unpaid',
					},
				],
				expected: {
					validCount: 1,
					netSum: quantityBounds.maximum * unitCostBounds.maximum,
					grossSum: quantityBounds.maximum * unitCostBounds.maximum,
					grossOutstanding: quantityBounds.maximum * unitCostBounds.maximum,
				},
			},
		],
		[
			'min total',
			{
				invoices: [
					{
						items: [{ quantity: quantityBounds.maximum, unitCost: unitCostBounds.minimum }],
						status: 'unpaid',
					},
				],
				expected: {
					validCount: 1,
					netSum: quantityBounds.maximum * unitCostBounds.minimum,
					grossSum: quantityBounds.maximum * unitCostBounds.minimum,
					grossOutstanding: quantityBounds.maximum * unitCostBounds.minimum,
				},
			},
		],
	])('Calculates dashboard stats correctly: %s', async ([, { invoices, expected }]) => {
		const { client } = await setUpConfigAndClient();
		await seedInvoices(client.data.scdId, invoices);

		const stats = await fetchStats();
		expect(stats.validCount).toBe(expected.validCount);
		expect(stats.totals).toEqual([
			expect.objectContaining({
				currency: 'AUD',
				netSum: expected.netSum.toFixed(4),
				grossSum: expected.grossSum.toFixed(4),
				grossOutstanding: expected.grossOutstanding.toFixed(4),
			}),
		]);
	});

	test('Returns a zero count and null totals when the user has no invoices', async () => {
		const stats = await fetchStats();
		expect(stats).toEqual({ validCount: 0, totals: null });
	});

	describe('Mixed currencies', () => {
		test('Aggregates totals separately per currency, instead of merging them together', async () => {
			const { client } = await setUpConfigAndClient({ currency: 'AUD' });
			await insertTestInvoice({
				clientDataId: client.data.scdId,
				items: [{ quantity: 1, unitCost: 100 }],
			});

			// A later config change to a new currency must not merge into the earlier AUD total
			await insertTestConfig({ currency: 'USD' });
			await insertTestInvoice({
				clientDataId: client.data.scdId,
				items: [{ quantity: 1, unitCost: 50 }],
			});

			const stats = await fetchStats();
			expect(stats.validCount).toBe(2);
			expect(stats.totals).toHaveLength(2);
			expect(stats.totals).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						currency: 'AUD',
						netSum: '100.0000',
						grossSum: '100.0000',
						grossOutstanding: '100.0000',
					}),
					expect.objectContaining({
						currency: 'USD',
						netSum: '50.0000',
						grossSum: '50.0000',
						grossOutstanding: '50.0000',
					}),
				]),
			);
		});

		/** Privileged escape-hatch to set the createdAt column */
		async function setDocumentCreatedAt(db: TestTX, id: string, createdAt: string) {
			await db.execute(sql`SET LOCAL ROLE neondb_owner`);
			await db.update(tables.documents).set({ createdAt }).where(eq(tables.documents.id, id));
			await db.execute(sql`SET LOCAL ROLE authenticated`);
		}

		test.for([
			{
				expected: ['AUD', 'USD'],
				invoices: [
					{ currency: 'AUD', createdAt: '2026-02-01T00:00:00Z' },
					{ currency: 'USD', createdAt: '2026-01-01T00:00:00Z' },
				],
			},
			{
				expected: ['USD', 'AUD'],
				invoices: [
					{ currency: 'AUD', createdAt: '2026-01-01T00:00:00Z' },
					{ currency: 'USD', createdAt: '2026-02-01T00:00:00Z' },
				],
			},
		])(
			'Orders currency totals by most recent invoice: $expected',
			async ({ invoices, expected }, { db }) => {
				const { client } = await setUpConfigAndClient();

				// Insert in fixed order so sorting relies strictly on createdAt
				for (const { currency, createdAt } of invoices) {
					await insertTestConfig({ currency });
					const id = await insertTestInvoice({ clientDataId: client.data.scdId });
					await setDocumentCreatedAt(db, id, createdAt);
				}

				const stats = await fetchStats();
				expect(stats.totals?.map(t => t.currency)).toEqual(expected);
			},
		);
	});
});
