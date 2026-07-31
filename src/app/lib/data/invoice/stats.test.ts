import { describe, expect } from 'vitest';

import { voidInvoice } from '@/lib/actions/invoice';
import {
	insertTestConfig,
	insertTestInvoice,
	setUpConfigAndClient,
} from '@/lib/actions/tests/helpers';
import { type Enum } from '@/lib/utils/drizzle';
import { invoice as invoiceSchema } from '@/lib/validation/invoice';
import { numberBounds } from '@/lib/zod';
import type * as tables from '@/db/schema';

import { asUser as test } from '@/test/session';

import { fetchStats } from './stats';

type Item = { quantity: number; unitCost: number };

const quantityBounds = numberBounds(invoiceSchema.shape.items.element.shape.quantity);
const unitCostBounds = numberBounds(invoiceSchema.shape.items.element.shape.unitCost);

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
						items: [{ quantity: quantityBounds.maxValue, unitCost: unitCostBounds.maxValue }],
						status: 'unpaid',
					},
				],
				expected: {
					validCount: 1,
					netSum: quantityBounds.maxValue * unitCostBounds.maxValue,
					grossSum: quantityBounds.maxValue * unitCostBounds.maxValue,
					grossOutstanding: quantityBounds.maxValue * unitCostBounds.maxValue,
				},
			},
		],
		[
			'min total',
			{
				invoices: [
					{
						items: [{ quantity: quantityBounds.maxValue, unitCost: unitCostBounds.minValue }],
						status: 'unpaid',
					},
				],
				expected: {
					validCount: 1,
					netSum: quantityBounds.maxValue * unitCostBounds.minValue,
					grossSum: quantityBounds.maxValue * unitCostBounds.minValue,
					grossOutstanding: quantityBounds.maxValue * unitCostBounds.minValue,
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
				netSum: expected.netSum,
				grossSum: expected.grossSum,
				grossOutstanding: expected.grossOutstanding,
			}),
		]);
	});

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
					netSum: 100,
					grossSum: 100,
					grossOutstanding: 100,
				}),
				expect.objectContaining({
					currency: 'USD',
					netSum: 50,
					grossSum: 50,
					grossOutstanding: 50,
				}),
			]),
		);
	});

	test('Returns a zero count and null totals when the user has no invoices', async () => {
		const stats = await fetchStats();
		expect(stats).toEqual({ validCount: 0, totals: null });
	});
});
