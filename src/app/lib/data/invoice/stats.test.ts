import { eq } from 'drizzle-orm';
import { assert, describe, expect } from 'vitest';
import { z } from 'zod';

import { type Enum } from '@/lib/utils/drizzle';
import { item as itemSchema } from '@/lib/validation/document';
import { getBounds } from '@/lib/zod';
import * as tables from '@/db/schema';

import { bypassRLS, createTestSession, sessionStorage, asUser as test } from '@/test/session';

import { fetchStats } from './stats';

const isNumber = (schema: z.core.$ZodType): schema is z.core.$ZodNumber | z.core.$ZodNumberFormat =>
	schema instanceof z.ZodNumber || schema instanceof z.ZodNumberFormat;

const quantityBounds = getBounds(itemSchema.shape.quantity, isNumber);
const unitCostBounds = getBounds(itemSchema.shape.unitCost, isNumber);

describe('fetchStats', () => {
	/** Builds invoice seed override with a single item costing `total`, untaxed by default. */
	const invoice = (
		total: number,
		status: Enum<typeof tables.statusEnum>,
		{ isVoid = false, taxes = [] }: { isVoid?: boolean; taxes?: string[] } = {},
	) => ({
		status: { status, isVoid },
		items: [{ quantity: '1' as const, unitCost: `${total}` as const, taxes }],
	});

	const unpaid = (total: number, taxes?: string[]) => invoice(total, 'unpaid', { taxes });
	const paid = (total: number, taxes?: string[]) => invoice(total, 'paid', { taxes });
	const refunded = (total: number) => invoice(total, 'refunded');
	const voided = (total: number) => invoice(total, 'unpaid', { isVoid: true });

	/** Fetches the stats of a user who invoices in one currency, as plain numbers. */
	const fetchTotals = async () => {
		const { validCount, totals } = await fetchStats();
		assert(totals?.length === 1, 'Expected totals for a single currency');

		const [{ netSum, grossSum, grossOutstanding }] = totals;
		return {
			count: validCount,
			net: Number(netSum),
			gross: Number(grossSum),
			outstanding: Number(grossOutstanding),
		};
	};

	describe('Totals', () => {
		test('Sums invoices with coinciding totals', async ({ seed }) => {
			// ie. not SUM DISTINCT
			await seed.invoices({ overrides: [unpaid(100), unpaid(100)] });
			expect(await fetchTotals()).toEqual({ count: 2, net: 200, gross: 200, outstanding: 200 });
		});

		test('Sums invoices with fractional totals', async ({ seed }) => {
			await seed.invoices({ overrides: [unpaid(33.33), unpaid(66.67)] });
			expect(await fetchTotals()).toEqual({ count: 2, net: 100, gross: 100, outstanding: 100 });
		});

		test('Deducts an invoice with a negative total (credit note)', async ({ seed }) => {
			await seed.invoices({ overrides: [unpaid(100), unpaid(-40)] });
			expect(await fetchTotals()).toEqual({ count: 2, net: 60, gross: 60, outstanding: 60 });
		});

		test('Counts an invoice with a zero total', async ({ seed }) => {
			await seed.invoices({ overrides: [unpaid(0), unpaid(50)] });
			expect(await fetchTotals()).toEqual({ count: 2, net: 50, gross: 50, outstanding: 50 });
		});

		test('Counts a refunded invoice, but excludes it from every sum', async ({ seed }) => {
			await seed.invoices({ overrides: [refunded(100), unpaid(50)] });
			expect(await fetchTotals()).toEqual({ count: 2, net: 50, gross: 50, outstanding: 50 });
		});

		test('Excludes a paid invoice from the outstanding amount only', async ({ seed }) => {
			await seed.invoices({ overrides: [paid(100), unpaid(50)] });
			expect(await fetchTotals()).toEqual({ count: 2, net: 150, gross: 150, outstanding: 50 });
		});

		test('Excludes a voided invoice from the count and every sum', async ({ seed }) => {
			await seed.invoices({ overrides: [voided(100), unpaid(50)] });
			expect(await fetchTotals()).toEqual({ count: 1, net: 50, gross: 50, outstanding: 50 });
		});

		test('Sums gross totals inclusive of tax', async ({ seed }) => {
			const [gst] = await seed.taxes({ overrides: [{ name: 'GST', rate: '0.1000' }] });
			await seed.config({ overrides: [{ taxRegistration: true }] });
			await seed.invoices({ overrides: [unpaid(100, [gst.id]), paid(100, [gst.id])] });

			// Net, gross and outstanding all differ, so each figure can only come from its own column
			expect(await fetchTotals()).toEqual({ count: 2, net: 200, gross: 220, outstanding: 110 });
		});

		test.for([
			['most positive', unitCostBounds.maximum],
			['most negative', unitCostBounds.minimum],
		] as const)('Does not overflow at the %s invoice total', async ([, unitCost], { seed }) => {
			const quantity = quantityBounds.maximum;
			const total = quantity * unitCost;

			await seed.invoices({
				overrides: [
					{
						status: { status: 'unpaid', isVoid: false },
						items: [{ quantity: `${quantity}`, unitCost: `${unitCost}`, taxes: [] }],
					},
				],
			});

			expect(await fetchTotals()).toEqual({
				count: 1,
				net: total,
				gross: total,
				outstanding: total,
			});
		});
	});

	test('Returns a zero count and null totals when the user has no invoices', async () => {
		const stats = await fetchStats();
		expect(stats).toEqual({ validCount: 0, totals: null });
	});

	test('Only aggregates invoices belonging to the authenticated user', async ({ auth, seed }) => {
		const other = await createTestSession(auth);
		await seed({ userId: other.user.id }).invoices({ overrides: [unpaid(1000)] });
		await seed.invoices({ overrides: [unpaid(50)] });

		const mine = await bypassRLS(() => fetchTotals()); // Checks that withRLS is not the only protection
		expect(mine).toEqual({ count: 1, net: 50, gross: 50, outstanding: 50 });

		const theirs = await bypassRLS(() => sessionStorage.run(other, () => fetchTotals()));
		expect(theirs).toEqual({ count: 1, net: 1000, gross: 1000, outstanding: 1000 });
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
						items: [{ quantity: '1', unitCost: '33.33', taxes: [] }],
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
						netSum: '33.3300',
						grossSum: '33.3300',
						grossOutstanding: '33.3300',
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
