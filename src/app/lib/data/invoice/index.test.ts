import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import * as navigation from 'next/navigation';
import { assert, describe, expect } from 'vitest';

import {
	setUpConfigAndClient as insertConfigAndClient,
	insertTestClient,
	insertTestConfig,
	insertTestInvoice,
} from '@/lib/actions/tests/helpers';
import { formatCurrency } from '@/lib/utils/currencies';
import { taxes as taxesSchema } from '@/lib/validation/config';
import { invoice as invoiceSchema } from '@/lib/validation/invoice';
import { arrayBounds, numberBounds } from '@/lib/zod';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { createTestSession, sessionStorage, asUser as test } from '@/test/session';

import { fetchInvoice, fetchInvoices, fetchInvoicesForClient } from './index';

type Item = { quantity: number; unitCost: number };

const quantityBounds = numberBounds(invoiceSchema.shape.items.element.shape.quantity);
const unitCostBounds = numberBounds(invoiceSchema.shape.items.element.shape.unitCost);

const taxRateBounds = numberBounds(taxesSchema.def.element.shape.rate);

const itemsBounds = arrayBounds(invoiceSchema.shape.items);
const taxCountBounds = arrayBounds(taxesSchema);

/** Inserts an active config and client, returning the client data id */
async function setUpConfigAndClient(configOverrides?: Parameters<typeof insertTestConfig>[0]) {
	const { client } = await insertConfigAndClient(configOverrides);
	return client.data.scdId;
}

/** Looks up tax ids by name from the taxes just inserted via `insertTestConfig` */
const getTaxIds = (names: string[]) =>
	withRLS(async db => {
		const rows = await db
			.select({ id: tables.taxes.id, name: tables.taxes.name })
			.from(tables.taxes);
		return names.map(name => {
			const row = rows.find(r => r.name === name);
			assert(row, `Tax "${name}" should exist after config was seeded`);
			return row.id;
		});
	});

describe('fetchInvoice', () => {
	test('Throws notFound() for a nonexistent invoice id', async () => {
		await expect(fetchInvoice(randomUUID())).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();
	});

	// We use notFound() rather than forbidden() to avoid leaking resource existence
	test('Throws notFound() when fetching an invoice with incorrect ownership', async ({
		db,
		auth,
	}) => {
		const otherSession = await createTestSession(db, auth);

		const id = await insertTestInvoice({
			clientDataId: await setUpConfigAndClient(),
			items: [{ quantity: 1, unitCost: 100 }],
		});

		await expect(sessionStorage.run(otherSession, () => fetchInvoice(id))).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		await expect(fetchInvoice(id)).resolves.not.toThrow();
	});

	describe('Invoice totals', () => {
		test.for<[string, Item[], number]>([
			[
				'coinciding amounts',
				[
					{ quantity: 1, unitCost: 50 },
					{ quantity: 1, unitCost: 50 },
					{ quantity: 2, unitCost: 50 },
				],
				200,
			],
			[
				'fractional amounts',
				[
					{ quantity: 1, unitCost: 33.33 },
					{ quantity: 1, unitCost: 33.33 },
					{ quantity: 1, unitCost: 0.01 },
				],
				66.67,
			],
			[
				// Credit or discount is a valid line item
				'negative-cost item',
				[
					{ quantity: 1, unitCost: 100 },
					{ quantity: 1, unitCost: -30 },
					{ quantity: 1, unitCost: -0.1 },
				],
				69.9,
			],
			[
				'zero-quantity item',
				[
					{ quantity: 0, unitCost: 50 },
					{ quantity: 1, unitCost: 50 },
				],
				50,
			],
			[
				'zero-cost item',
				[
					{ quantity: 1, unitCost: 0 },
					{ quantity: 1, unitCost: 50 },
				],
				50,
			],
		])('Calculates net total correctly: %s', async ([_, items, expected]) => {
			const invoice = await fetchInvoice(
				await insertTestInvoice({ clientDataId: await setUpConfigAndClient(), items }),
			);

			// No tax registration: gross must equal net
			expect(invoice.netTotal).toBe(expected);
			expect(invoice.grossTotal).toBe(expected);
		});

		test('grossTotal does not overflow across the max item count', async () => {
			const id = await insertTestInvoice({
				clientDataId: await setUpConfigAndClient(),
				items: Array.from({ length: itemsBounds.maxLength }, () => ({
					quantity: 1,
					unitCost: unitCostBounds.maxValue,
				})),
			});

			const invoice = await fetchInvoice(id);
			expect(invoice.grossTotal).toBe(
				Math.round(unitCostBounds.maxValue * itemsBounds.maxLength * 100) / 100,
			);
		});
	});

	describe('Item gross amount', () => {
		/** Creates an invoice of `itemCount` identical items taxed by each of `rates`, returning the fetched invoice */
		async function itemGrossAmount(unitCost: number, rates: number[], itemCount = 1) {
			const names = rates.map((_, i) => `TAX_${i}`);

			const clientDataId = await setUpConfigAndClient({
				taxRegistration: true,
				taxes: rates.map((rate, i) => ({ name: names[i], rate })),
			});
			const taxIds = await getTaxIds(names);

			const id = await insertTestInvoice({
				clientDataId,
				items: Array.from({ length: itemCount }, () => ({
					quantity: 1,
					unitCost,
					taxes: new Set(taxIds),
				})),
			});

			return fetchInvoice(id);
		}

		test.for<[string, { unitCost: number; rates: [number, number]; expectedGross: number }]>([
			['coinciding rates', { unitCost: 100, rates: [10, 10], expectedGross: 120 }],
			['fractional rates', { unitCost: 100, rates: [12.5, 7.5], expectedGross: 120 }],
			['zero-rate tax', { unitCost: 100, rates: [0, 10], expectedGross: 110 }],
		])('Calculates item gross amount correctly: %s', async ([
			,
			{ unitCost, rates, expectedGross },
		]) => {
			const invoice = await itemGrossAmount(unitCost, rates);
			expect(invoice.items[0].grossAmount).toBe(expectedGross);
			expect(invoice.grossTotal).toBe(expectedGross);
		});

		const expectedItemGross =
			unitCostBounds.maxValue * (1 + (taxCountBounds.maxLength * taxRateBounds.maxValue) / 100);
		test(`Invoice gross total cannot overflow: ${formatCurrency(expectedItemGross * itemsBounds.maxLength, 'AUD', 'en-AU')}`, async () => {
			const invoice = await itemGrossAmount(
				unitCostBounds.maxValue,
				Array(taxCountBounds.maxLength).fill(taxRateBounds.maxValue),
				itemsBounds.maxLength,
			);

			expect(invoice.grossTotal).toBe(expectedItemGross * itemsBounds.maxLength);
		});
	});

	describe('Tax registration status', () => {
		test('Gross equals net when no taxes are configured at all', async () => {
			const clientDataId = await setUpConfigAndClient({ taxRegistration: false, taxes: [] });
			const id = await insertTestInvoice({ clientDataId, items: [{ quantity: 1, unitCost: 100 }] });

			const invoice = await fetchInvoice(id);
			expect(invoice.netTotal).toBe(100);
			expect(invoice.grossTotal).toBe(100);
		});

		describe.for([true, false])('When taxRegistration is %s', taxRegistration => {
			test('Gross total when the item is linked to a tax', async () => {
				const configId = await insertTestConfig({
					taxRegistration,
					taxes: [{ name: 'GST', rate: 10 }],
				});

				const invoiceId = await insertTestInvoice({
					clientDataId: await insertTestClient().then(res => res.data.scdId),
					items: [{ quantity: 1, unitCost: 100 }],
				});

				const [gst] = await getTaxIds(['GST']);

				await withRLS(async (db, session) => {
					// Link the item to the tax directly in the DB, rather than via `createInvoice`
					// which refuses to link taxes while unregistered
					//
					// This tests that the tax is not added on the DB view level, regardless of the guard in the server action

					const [item] = await db
						.select({ id: tables.invoiceItems.id })
						.from(tables.invoiceItems)
						.where(eq(tables.invoiceItems.invoiceId, invoiceId));

					await db
						.insert(tables.itemTaxes)
						.values({ itemId: item.id, taxId: gst, configId, userId: session.user.id });
				});

				const invoice = await fetchInvoice(invoiceId);

				expect(invoice.netTotal).toBe(100);
				expect(invoice.grossTotal).toBe(taxRegistration ? 110 : 100);
			});

			test('Gross and net totals are equal when item is not linked to a tax', async () => {
				const id = await insertTestInvoice({
					clientDataId: await setUpConfigAndClient(),
					items: [{ quantity: 1, unitCost: 100, taxes: new Set() }],
				});

				const invoice = await fetchInvoice(id);
				expect(invoice.netTotal).toEqual(invoice.grossTotal);
			});
		});
	});

	describe('Tax contribution', () => {
		test.for<[string, (Item & { taxed?: boolean })[], number]>([
			[
				'coinciding contributions',
				[
					{ quantity: 1, unitCost: 50, taxed: true },
					{ quantity: 1, unitCost: 50, taxed: true },
				],
				10,
			],
			[
				'fractional contributions',
				[
					{ quantity: 1, unitCost: 33.34, taxed: true },
					{ quantity: 1, unitCost: 33.33, taxed: true },
				],
				6.667,
			],
			[
				'negative-cost item',
				[
					{ quantity: 1, unitCost: 100, taxed: true },
					{ quantity: 1, unitCost: -40, taxed: true },
				],
				6,
			],
			[
				'zero-cost item',
				[
					{ quantity: 1, unitCost: 0, taxed: true },
					{ quantity: 1, unitCost: 50, taxed: true },
				],
				5,
			],
			['unlinked item', [{ quantity: 1, unitCost: 50, taxed: false }], 0],
			[
				'max unit cost',
				[{ quantity: 1, unitCost: unitCostBounds.maxValue, taxed: true }],
				unitCostBounds.maxValue * 0.1,
			],
			[
				'min unit cost',
				[{ quantity: 1, unitCost: unitCostBounds.minValue, taxed: true }],
				unitCostBounds.minValue * 0.1,
			],
			[
				'max quantity',
				[{ quantity: quantityBounds.maxValue, unitCost: unitCostBounds.maxValue, taxed: true }],
				quantityBounds.maxValue * unitCostBounds.maxValue * 0.1,
			],
		])('Calculates tax contribution correctly: %s', async ([, items, expectedContribution]) => {
			const clientDataId = await setUpConfigAndClient({
				taxRegistration: true,
				taxes: [{ name: 'GST', rate: 10 }],
			});
			const [gst] = await getTaxIds(['GST']);

			const id = await insertTestInvoice({
				clientDataId,
				items: items.map(({ taxed, ...item }) => ({
					...item,
					taxes: new Set(taxed ? [gst] : []),
				})),
			});

			const invoice = await fetchInvoice(id);
			expect(invoice.tax).toEqual([{ name: 'GST', contribution: expectedContribution }]);
		});

		test('Two tax rows sharing a name but different rates collapse into a single breakdown row', async () => {
			const clientDataId = await setUpConfigAndClient({
				taxRegistration: true,
				// Same name, different rates: allowed since the uniqueness constraint is on (name, rate)
				taxes: [
					{ name: 'GST', rate: 10 },
					{ name: 'GST', rate: 5 },
				],
			});

			const rows = await withRLS(db =>
				db.select({ id: tables.taxes.id, rate: tables.taxes.rate }).from(tables.taxes),
			);
			const gst10 = rows.find(r => r.rate === 0.1);
			const gst5 = rows.find(r => r.rate === 0.05);
			assert(gst10, 'GST at 10% should exist after config was seeded');
			assert(gst5, 'GST at 5% should exist after config was seeded');

			const id = await insertTestInvoice({
				clientDataId,
				items: [
					{ quantity: 1, unitCost: 100, taxes: new Set([gst10.id]) },
					{ quantity: 1, unitCost: 100, taxes: new Set([gst5.id]) },
				],
			});

			const invoice = await fetchInvoice(id);
			// 100 * 10% + 100 * 5%, collapsed into a single 'GST' row, not two
			expect(invoice.tax).toEqual([{ name: 'GST', contribution: 15 }]);
		});

		test('Breakdown rows are ordered by configured tax order', async () => {
			const clientDataId = await setUpConfigAndClient({
				taxRegistration: true,
				// Alphabetically, 'ATAX' would sort before 'ZTAX' — the opposite of configured order
				taxes: [
					{ name: 'ZTAX', rate: 10 },
					{ name: 'ATAX', rate: 5 },
				],
			});

			const id = await insertTestInvoice({
				clientDataId,
				items: [{ quantity: 1, unitCost: 100 }],
			});

			const invoice = await fetchInvoice(id);
			expect(invoice.tax.map(t => t.name)).toEqual(['ZTAX', 'ATAX']);
		});
	});
});

describe('fetchInvoices', () => {
	test('Lists invoices ordered by index, descending', async () => {
		const clientDataId = await setUpConfigAndClient();
		const first = await insertTestInvoice({
			clientDataId,
			items: [{ quantity: 1, unitCost: 100 }],
		});
		const second = await insertTestInvoice({
			clientDataId,
			items: [{ quantity: 1, unitCost: 100 }],
		});

		const invoices = await fetchInvoices();
		expect(invoices.map(i => i.id)).toEqual([second, first]);
	});

	test('Respects the limit parameter', async () => {
		const clientDataId = await setUpConfigAndClient();
		await insertTestInvoice({ clientDataId, items: [{ quantity: 1, unitCost: 100 }] });
		await insertTestInvoice({ clientDataId, items: [{ quantity: 1, unitCost: 100 }] });

		const invoices = await fetchInvoices(undefined, 1);
		expect(invoices).toHaveLength(1);
	});

	test('Computes the invoice reference from the numbering scheme', async () => {
		const clientDataId = await setUpConfigAndClient();
		await insertTestInvoice({ clientDataId, items: [{ quantity: 1, unitCost: 100 }] });

		const [invoice] = await fetchInvoices();
		expect(invoice.reference).toBe('INV-001');
	});

	test('Only returns invoices belonging to the authenticated user', async ({ db, auth }) => {
		const clientDataId = await setUpConfigAndClient();
		await insertTestInvoice({ clientDataId, items: [{ quantity: 1, unitCost: 100 }] });

		const otherSession = await createTestSession(db, auth);
		const otherInvoices = await sessionStorage.run(otherSession, () => fetchInvoices());
		expect(otherInvoices).toEqual([]);
	});
});

describe('fetchInvoicesForClient', () => {
	test('Scopes invoices to the given client only', async () => {
		await insertTestConfig();
		const clientA = await insertTestClient();
		const clientB = await insertTestClient();

		const invoiceA = await insertTestInvoice({
			clientDataId: clientA.data.scdId,
			items: [{ quantity: 1, unitCost: 100 }],
		});
		await insertTestInvoice({
			clientDataId: clientB.data.scdId,
			items: [{ quantity: 1, unitCost: 50 }],
		});

		const invoices = await fetchInvoicesForClient(clientA.id);
		expect(invoices.map(i => i.id)).toEqual([invoiceA]);
	});
});
