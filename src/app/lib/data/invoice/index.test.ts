import { randomUUID } from 'node:crypto';
import { type DBQueryConfigOrderBy, eq, type FieldSelection, sql } from 'drizzle-orm';
import * as navigation from 'next/navigation';
import { describe, expect } from 'vitest';
import { z } from 'zod';

import { Invoice } from '@/api/dto/invoice';
import { percentToRate } from '@/lib/utils';
import { taxes as taxesSchema } from '@/lib/validation/config';
import { invoice as invoiceSchema } from '@/lib/validation/invoice';
import { getBounds } from '@/lib/zod';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { bypassRLS, createTestSession, sessionStorage, asUser as test } from '@/test/session';

import { fetchInvoice, fetchInvoices, fetchInvoicesForClient } from './index';

type Item = Pick<typeof tables.lineItems.$inferInsert, 'quantity' | 'unitCost'>;

const isNumber = (schema: z.core.$ZodType): schema is z.core.$ZodNumber | z.core.$ZodNumberFormat =>
	schema instanceof z.ZodNumber || schema instanceof z.ZodNumberFormat;
const isArray = (schema: z.core.$ZodType): schema is z.core.$ZodArray =>
	schema instanceof z.ZodArray;

const quantityBounds = getBounds(invoiceSchema.shape.items.element.shape.quantity, isNumber, {
	minimum: -Infinity,
});
const unitCostBounds = getBounds(invoiceSchema.shape.items.element.shape.unitCost, isNumber, {
	minimum: -Infinity,
});

const taxRateBounds = getBounds(taxesSchema.def.element.shape.rate, isNumber, {
	minimum: -Infinity,
});

const itemsBounds = getBounds(invoiceSchema.shape.items, isArray);
const taxCountBounds = getBounds(taxesSchema, isArray);

describe('fetchInvoice() and fetchInvoices()', () => {
	const fetchBoth = async (id: string) => [
		await fetchInvoice(id),
		...(await fetchInvoices({ limit: 200 })),
	];

	describe('Dates', () => {
		/** Reads the creation timestamp as Postgres prints it. */
		const storedCreatedAt = async () => {
			const [document] = await withRLS(tx =>
				tx.select({ createdAt: tables.documents.createdAt }).from(tables.documents),
			);
			return document.createdAt;
		};

		/** Returns the invoice and invoice list from both read paths. */
		const fetchDates = (id: string) =>
			fetchBoth(id).then(arr =>
				arr.map(v => ({ createdAt: v.createdAt, issuedAt: v.issuedAt, dueAt: v.dueAt })),
			);

		test('Serializes createdAt in UTC with millisecond precision', async ({ db, seed }) => {
			const [{ id }] = await seed.invoices({ count: 1 });

			// Microseconds must be dropped, and trailing zeros kept
			await bypassRLS(() =>
				db
					.update(tables.documents)
					.set({ createdAt: '2026-01-15T20:30:00.100209760+11:00' })
					.where(eq(tables.documents.id, id)),
			);

			const createdAt = (await fetchDates(id)).map(date => date.createdAt);

			expect(createdAt).toEqual(['2026-01-15T09:30:00.100Z', '2026-01-15T09:30:00.100Z']);
			await z.array(Invoice.shape.createdAt).parseAsync(createdAt);
		});

		test('Are unaffected by the database session timezone', async ({ db, seed }) => {
			const [{ id }] = await seed.invoices({ count: 1 });
			const dates = await fetchDates(id);

			// Postgres prints timestamptz in the session timezone, so the raw value changes offset
			await db.execute(sql`SET LOCAL TimeZone = 'Pacific/Kiritimati'`);
			expect(await storedCreatedAt()).toMatch(/\+14$/);

			expect(await fetchDates(id)).toEqual(dates);
		});
	});
});

describe('fetchInvoice()', () => {
	test('Throws notFound() for a nonexistent invoice id', async () => {
		await expect(fetchInvoice(randomUUID())).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();
	});

	// We use notFound() rather than forbidden() to avoid leaking resource existence
	test('Throws notFound() for invoice with different ownership', async ({ auth, seed }) => {
		const otherSession = await createTestSession(auth);
		const [{ id }] = await seed.invoices({ count: 1 });

		// Checks that withRLS is not the only protection
		await expect(
			bypassRLS(() => sessionStorage.run(otherSession, () => fetchInvoice(id))),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		await expect(fetchInvoice(id)).resolves.not.toThrow();
	});

	describe('Invoice totals', () => {
		test.for<[string, Item[], number]>([
			[
				'coinciding amounts',
				[
					{ quantity: '1', unitCost: '50' },
					{ quantity: '1', unitCost: '50' },
					{ quantity: '2', unitCost: '50' },
				],
				200,
			],
			[
				'fractional amounts',
				[
					{ quantity: '1', unitCost: '33.33' },
					{ quantity: '1', unitCost: '33.33' },
					{ quantity: '1', unitCost: '0.01' },
				],
				66.67,
			],
			[
				// Credit or discount is a valid line item
				'negative-cost item',
				[
					{ quantity: '1', unitCost: '100' },
					{ quantity: '1', unitCost: '-30' },
					{ quantity: '1', unitCost: '-0.1' },
				],
				69.9,
			],
			[
				'zero-quantity item',
				[
					{ quantity: '0', unitCost: '50' },
					{ quantity: '1', unitCost: '50' },
				],
				50,
			],
			[
				'zero-cost item',
				[
					{ quantity: '1', unitCost: '0' },
					{ quantity: '1', unitCost: '50' },
				],
				50,
			],
		])('Calculates net total correctly: %s', async ([_, items, expected], { seed }) => {
			await seed.config({ overrides: [{ taxRegistration: false }] });
			const [{ id }] = await seed.invoices({ overrides: [{ items }] });

			const invoice = await fetchInvoice(id);

			// No tax registration: gross must equal net
			expect(invoice.netTotal).toBe(expected.toFixed(4));
			expect(invoice.grossTotal).toBe(expected.toFixed(4));
		});

		test('grossTotal does not overflow across the max item count', async ({ seed }) => {
			const items = Array.from(
				{ length: itemsBounds.maximum },
				(): Item => ({
					quantity: '1',
					unitCost: `${unitCostBounds.maximum}`,
				}),
			);

			await seed.config({ overrides: [{ taxRegistration: false }] });
			const [{ id }] = await seed.invoices({ overrides: [{ items }] });

			const invoice = await fetchInvoice(id);
			expect(invoice.grossTotal).toBe(
				(Math.round(unitCostBounds.maximum * itemsBounds.maximum * 100) / 100).toFixed(4),
			);
		});
	});

	describe('Item gross amount', () => {
		test.for<[string, { rates: [number, number]; expectedGross: number }]>([
			['coinciding rates', { rates: [10, 10], expectedGross: 120 }],
			['fractional rates', { rates: [12.5, 7.5], expectedGross: 120 }],
			['zero-rate tax', { rates: [0, 10], expectedGross: 110 }],
		])(
			'Calculates item gross amount correctly: %s',
			async ([, { rates, expectedGross }], { seed }) => {
				const taxes = await seed.taxes({
					overrides: rates.map((rate, i) => ({ name: `TAX_${i}`, rate: percentToRate(rate) })),
				});
				await seed.config({ overrides: [{ taxRegistration: true }] });

				const [seeded] = await seed.invoices({
					overrides: [
						{ items: [{ quantity: '1', unitCost: '100', taxes: taxes.map(tax => tax.id) }] },
					],
				});

				const invoice = await fetchInvoice(seeded.id);
				expect(invoice.items[0].grossAmount).toBe(expectedGross.toFixed(4));
				expect(invoice.grossTotal).toBe(expectedGross.toFixed(4));
			},
		);

		const expectedItemGross =
			unitCostBounds.maximum * (1 + (taxCountBounds.maximum * taxRateBounds.maximum) / 100);
		test(`Invoice gross total cannot overflow`, async ({ seed }) => {
			const taxes = await seed.taxes({
				overrides: Array.from({ length: taxCountBounds.maximum }, (_, i) => ({
					name: `TAX_${i}`,
					rate: percentToRate(taxRateBounds.maximum),
				})),
			});

			// Config attaches all defined taxes
			await seed.config({ overrides: [{ taxRegistration: true }] });

			// Every item at the maximum cost, taxed by the maximum number of taxes at the maximum rate
			const [seeded] = await seed.invoices({
				overrides: [
					{
						items: Array.from({ length: itemsBounds.maximum }, () => ({
							quantity: '1' as const,
							unitCost: `${unitCostBounds.maximum}` as const,
							taxes: taxes.map(tax => tax.id),
						})),
					},
				],
			});

			const invoice = await fetchInvoice(seeded.id);
			expect(invoice.grossTotal).toBe((expectedItemGross * itemsBounds.maximum).toFixed(4));
		});
	});

	describe('Tax registration status', () => {
		describe.for([true, false])('When taxRegistration is %s', taxRegistration => {
			test('Gross total when the item is linked to a tax', async ({ seed }) => {
				const [gst] = await seed.taxes({ overrides: [{ name: 'GST', rate: '0.1000' }] });
				await seed.config({ overrides: [{ taxRegistration }] });

				// `createInvoice()` will not link a tax to an item when not registered for tax.
				// This tests that the tax is calculated on the DB view level, regardless of that guard.
				const [seeded] = await seed.invoices({
					overrides: [{ items: [{ quantity: '1', unitCost: '100', taxes: [gst.id] }] }],
				});

				const invoice = await fetchInvoice(seeded.id);

				expect(invoice.netTotal).toBe('100.0000');
				expect(invoice.grossTotal).toBe(taxRegistration ? '110.0000' : '100.0000');
			});

			test('Gross and net totals are equal when item is not linked to a tax', async ({ seed }) => {
				await seed.config({ overrides: [{ taxRegistration }] });
				const [seeded] = await seed.invoices({
					overrides: [{ items: [{ quantity: '1', unitCost: '100', taxes: [] }] }],
				});

				const invoice = await fetchInvoice(seeded.id);

				expect(invoice.netTotal).toEqual(invoice.grossTotal);
			});
		});
	});

	describe('Tax contribution', () => {
		test.for<[string, (Item & { taxed?: boolean })[], number]>([
			[
				'coinciding contributions',
				[
					{ quantity: '1', unitCost: '50', taxed: true },
					{ quantity: '1', unitCost: '50', taxed: true },
				],
				10,
			],
			[
				'fractional contributions',
				[
					{ quantity: '1', unitCost: '33.34', taxed: true },
					{ quantity: '1', unitCost: '33.33', taxed: true },
				],
				6.667,
			],
			[
				'negative-cost item',
				[
					{ quantity: '1', unitCost: '100', taxed: true },
					{ quantity: '1', unitCost: '-40', taxed: true },
				],
				6,
			],
			[
				'zero-cost item',
				[
					{ quantity: '1', unitCost: '0', taxed: true },
					{ quantity: '1', unitCost: '50', taxed: true },
				],
				5,
			],
			['unlinked item', [{ quantity: '1', unitCost: '50', taxed: false }], 0],
			[
				'max unit cost',
				[{ quantity: '1', unitCost: `${unitCostBounds.maximum}`, taxed: true }],
				unitCostBounds.maximum * 0.1,
			],
			[
				'min unit cost',
				[{ quantity: '1', unitCost: `${unitCostBounds.minimum}`, taxed: true }],
				unitCostBounds.minimum * 0.1,
			],
			[
				'max quantity',
				[
					{
						quantity: `${quantityBounds.maximum}`,
						unitCost: `${unitCostBounds.maximum}`,
						taxed: true,
					},
				],
				quantityBounds.maximum * unitCostBounds.maximum * 0.1,
			],
		])(
			'Calculates tax contribution correctly: %s',
			async ([, items, expectedContribution], { seed }) => {
				const [gst] = await seed.taxes({ overrides: [{ name: 'GST', rate: '0.1' }] });
				await seed.config({ overrides: [{ taxRegistration: true }] });

				const [seeded] = await seed.invoices({
					overrides: [
						{
							items: items.map(({ taxed, ...item }) => ({ ...item, taxes: taxed ? [gst.id] : [] })),
						},
					],
				});

				const invoice = await fetchInvoice(seeded.id);

				expect(invoice.tax).toEqual([{ name: 'GST', contribution: expect.any(String) }]);
				expect(Number(invoice.tax[0]?.contribution)).toBeCloseTo(expectedContribution, 8);
			},
		);

		test('Taxes with same name collapse into a single contribution aggregate', async ({ seed }) => {
			// Same name, different rates: allowed since the uniqueness constraint is on (name, rate)
			const [gst10, gst5, gst1] = await seed.taxes({
				overrides: [
					{ name: 'GST', rate: '0.1000' },
					{ name: 'GST', rate: '0.0500' },
					{ name: 'GST', rate: '0.0100' },
				],
			});
			await seed.config({ overrides: [{ taxRegistration: true }] });

			const item = { quantity: '1', unitCost: '100' } as const;
			const [seeded] = await seed.invoices({
				overrides: [
					{
						items: [
							{ ...item, taxes: [gst10.id] },
							{ ...item, taxes: [gst5.id, gst1.id] },
						],
					},
				],
			});

			const invoice = await fetchInvoice(seeded.id);

			// 100 * 10% + (100 * 5% + 100 * 1%)
			// Collapsed into a single 'GST' row, despite being three separate taxes
			expect(invoice.tax).toEqual([{ name: 'GST', contribution: '16.00000000' }]);
		});

		test('Breakdown rows are ordered by configured tax order', async ({ seed }) => {
			// Alphabetically, 'ATAX' would sort before 'ZTAX' — the opposite of configured order
			await seed.taxes({ overrides: [{ name: 'ZTAX' }, { name: 'ATAX' }] });
			await seed.config({ overrides: [{ taxRegistration: true }] });

			const [{ id }] = await seed.invoices({
				overrides: [{ items: [{ quantity: '1', unitCost: '100', taxes: [] }] }],
			});

			const invoice = await fetchInvoice(id);
			expect(invoice.tax.map(t => t.name)).toEqual(['ZTAX', 'ATAX']);
		});
	});
});

describe('fetchInvoices()', () => {
	describe('orderBy', () => {
		test('Orders invoices by issued date (descending) by default', async ({ seed }) => {
			const [first, second] = await seed.invoices({
				overrides: [{ issuedAt: '2026-01-01' }, { issuedAt: '2026-01-02' }],
			});

			const invoices = await fetchInvoices({ limit: 200 });
			expect(invoices.map(i => i.id)).toEqual([second.id, first.id]);
		});

		test('Allows overriding the orderBy defaults', async ({ seed }) => {
			const [first, second] = await seed.invoices({
				overrides: [{ issuedAt: '2026-01-01' }, { issuedAt: '2026-01-02' }],
			});

			const invoicesDefault = await fetchInvoices({ limit: 200 });
			expect(invoicesDefault.map(i => i.id)).toEqual([second.id, first.id]);

			const invoicesOverride = await fetchInvoices({ limit: 200, orderBy: { issuedAt: 'asc' } });
			expect(invoicesOverride.map(i => i.id)).toEqual([first.id, second.id]);
		});

		test.for<[string, DBQueryConfigOrderBy<typeof tables.invoices, FieldSelection>]>([
			['object', { dueAt: 'asc' }],
			['callback', (invoice, { asc }) => asc(invoice.dueAt)],
		])('Allows extending the orderBy defaults with %s-form', async ([_, orderBy], { seed }) => {
			const seeded = await seed.invoices({
				overrides: [
					{ issuedAt: '2026-01-01', dueAt: '2026-02-03' },
					{ issuedAt: '2026-01-02', dueAt: '2026-02-02' },
					{ issuedAt: '2026-01-03', dueAt: '2026-02-03' },
					{ issuedAt: '2026-01-04', dueAt: '2026-02-03' },
				],
			});
			const [first, second, third, fourth] = seeded.map(invoice => invoice.id);

			const invoices = await fetchInvoices({ limit: 200, orderBy });
			// second has earliest due date, and so places first.
			// fourth, third, and first tie; order is resolved by fallback issuedAt 'desc'
			expect(invoices.map(i => i.id)).toEqual([second, fourth, third, first]);
		});
	});

	test('Respects the limit option', async ({ seed }) => {
		await seed.invoices({ count: 2 });

		const invoices = await fetchInvoices({ limit: 1 });
		expect(invoices).toHaveLength(1);
	});

	test('Computes the invoice reference from the numbering scheme', async ({ seed }) => {
		await seed.config({ overrides: [{ numberingScheme: 'sequential' }] });
		await seed.invoices({ count: 1 });

		const invoices = await fetchInvoices({ limit: 200 });
		const [invoice] = invoices;
		expect(invoice.reference).toBe('INV-001');
	});

	test('Only returns invoices belonging to the authenticated user', async ({ auth, seed }) => {
		await seed.invoices({ count: 1 });

		const other = await createTestSession(auth);
		// Checks that withRLS is not the only protection
		const otherInvoices = await bypassRLS(() =>
			sessionStorage.run(other, () => fetchInvoices({ limit: 200 })),
		);
		expect(otherInvoices).toEqual([]);
	});
});

describe('fetchInvoicesForClient()', () => {
	test('Scopes invoices to the given client only', async ({ seed }) => {
		const [clientA, clientB] = await seed.clients({ count: 2, versions: 1 });
		const [invoiceA, invoiceB] = await seed.invoices({
			overrides: [
				{ clientDataId: clientA.versions[0].id },
				{ clientDataId: clientB.versions[0].id },
			],
		});

		const invoicesA = await fetchInvoicesForClient(clientA.id, 200);
		expect(invoicesA.map(i => i.id)).toEqual([invoiceA.id]);

		const invoicesB = await fetchInvoicesForClient(clientB.id, 200);
		expect(invoicesB.map(i => i.id)).toEqual([invoiceB.id]);
	});
});
