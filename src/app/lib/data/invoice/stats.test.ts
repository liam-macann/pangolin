import { eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';
import { z } from 'zod';

import { type Enum } from '@/lib/utils/drizzle';
import { item as itemSchema } from '@/lib/validation/document';
import { getBounds } from '@/lib/zod';
import * as tables from '@/db/schema';

import { bypassRLS, asUser as test } from '@/test/session';

import { fetchStats } from './stats';

type Item = { quantity: number; unitCost: number };

const isNumber = (schema: z.core.$ZodType): schema is z.core.$ZodNumber | z.core.$ZodNumberFormat =>
	schema instanceof z.ZodNumber || schema instanceof z.ZodNumberFormat;

const quantityBounds = getBounds(itemSchema.shape.quantity, isNumber);
const unitCostBounds = getBounds(itemSchema.shape.unitCost, isNumber);

describe('fetchStats', () => {
	type InvoiceCase = { items: Item[]; status: Enum<typeof tables.statusEnum>; void?: boolean };
	type ExpectedStats = {
		validCount: number;
		netSum: number;
		grossSum: number;
		grossOutstanding: number;
	};

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
	])('Calculates dashboard stats correctly: %s', async ([, { invoices, expected }], { seed }) => {
		await seed.config({ overrides: [{ currency: 'AUD' }] });
		await seed.invoices({
			overrides: invoices.map(invoice => ({
				status: { status: invoice.status, isVoid: invoice.void ?? false },
				items: invoice.items.map(item => ({
					quantity: `${item.quantity}`,
					unitCost: `${item.unitCost}`,
					taxes: [],
				})),
			})),
		});

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
		test('Aggregates separate totals per currency, instead of merging them', async ({ seed }) => {
			const [aud, usd] = await seed.config({
				overrides: [{ currency: 'AUD' }, { currency: 'USD' }],
			});

			// Each invoice is created as an above config version takes effect, so references that version
			await seed.invoices({
				overrides: [
					{
						createdAt: aud.validFrom,
						status: { status: 'unpaid', isVoid: false },
						items: [{ quantity: '1', unitCost: '100', taxes: [] }],
					},
					{
						createdAt: usd.validFrom,
						status: { status: 'unpaid', isVoid: false },
						items: [{ quantity: '1', unitCost: '50', taxes: [] }],
					},
				],
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

		test('Orders currency totals by most recent invoice', async ({ db, seed }) => {
			const [aud, usd] = await seed.config({
				overrides: [{ currency: 'AUD' }, { currency: 'USD' }],
			});

			const invoices = await seed.invoices({
				overrides: [
					{ createdAt: aud.validFrom, status: { isVoid: false } },
					{ createdAt: usd.validFrom, status: { isVoid: false } },
				],
			});

			const getCurrencies = async () => (await fetchStats()).totals?.map(t => t.currency);

			// The USD config is active, so its invoice is the most recent
			expect(await getCurrencies()).toEqual(['USD', 'AUD']);

			// Only the date changes, so the reorder can only come from createdAt
			await bypassRLS(() =>
				db
					.update(tables.documents)
					.set({ createdAt: '2030-01-01T00:00:00Z' })
					.where(eq(tables.documents.id, invoices[0].id)),
			);

			expect(await getCurrencies()).toEqual(['AUD', 'USD']);
		});
	});
});
