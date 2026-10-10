import { base, en, Faker } from '@faker-js/faker';
import { Temporal } from 'temporal-polyfill';
import { describe, expect } from 'vitest';

import { fetchInvoice } from '@/lib/data/invoice';
import * as tables from '@/db/schema';
import { seedKeychain } from '@/db/seed/entities/encrypt';
import { type SeedContext } from '@/db/seed/shared/context';

import { type TestTX } from '@/test/pglite';
import { bypassRLS, asUser as test } from '@/test/session';

import { seedClients } from './clients';
import { seedConfig } from './config';
import { seedInvoices } from './invoices';
import { seedTaxes } from './taxes';

/** Builds a context for testing an entity seeder. */
async function createSeedContext(tx: SeedContext['tx'], userId: string): Promise<SeedContext> {
	const faker = new Faker({ locale: [en, base] });
	faker.seed(42);

	return {
		tx,
		userId,
		faker,
		encrypt: await seedKeychain(tx, userId),
		from: Temporal.Instant.from('2023-01-01T00:00:00Z'),
		to: Temporal.Instant.from('2026-03-15T02:30:00Z'),
	};
}

test.aroundEach(async runTest => bypassRLS(() => runTest()));

const setup = async (db: TestTX, userId: string) => {
	const ctx = await createSeedContext(db, userId);
	const [tax] = await seedTaxes(ctx, { count: 1, overrides: { rate: '0.1000' } });

	const dependencies = {
		configs: await seedConfig(
			ctx,
			{ versions: 1, overrides: { taxRegistration: true } },
			{ taxes: [tax] },
		),
		clients: await seedClients(ctx, { count: 1, versions: 1 }),
	};

	return { ctx, tax, deps: dependencies };
};

describe('seedInvoices', () => {
	test('Deduplicates tax IDs within each item', async ({ db, session }) => {
		const { ctx, tax, deps } = await setup(db, session.user.id);

		const item = { quantity: '1' as const, unitCost: '100' as const, taxes: [tax.id, tax.id] };
		const [invoice] = await seedInvoices(
			ctx,
			{ count: 1, overrides: { items: [item, item] } },
			deps,
		);

		const itemTaxes = await db.select().from(tables.itemTaxes);
		expect(itemTaxes.map(link => link.taxId)).toEqual([tax.id, tax.id]);
		expect(new Set(itemTaxes.map(link => link.itemId))).toHaveLength(2);

		expect(await fetchInvoice(invoice.id)).toMatchObject({ grossTotal: '220.0000' });
	});

	test('Numbers invoices in creation order, not insertion order', async ({ db, session }) => {
		const { ctx, deps } = await setup(db, session.user.id);

		// Issued in one year, so both share a partition under either numbering scheme
		const [later, earlier] = await seedInvoices(
			ctx,
			{
				count: 2,
				overrides: [
					{ createdAt: '2025-06-01T00:00:00Z', issuedAt: '2025-06-01' },
					{ createdAt: '2025-01-01T00:00:00Z', issuedAt: '2025-01-01' },
				],
			},
			deps,
		);

		expect(later.issuedAt, 'Rows should still line up with their overrides').toBe('2025-06-01');
		expect([earlier.index, later.index]).toEqual([1, 2]);
	});

	test('Adds invoice batches with gapless numbering', async ({ db, session }) => {
		const { ctx, deps } = await setup(db, session.user.id);

		const invoices = [
			...(await seedInvoices(ctx, { count: 3 }, deps)),
			...(await seedInvoices(ctx, { count: 4 }, deps)),
		];

		expect(invoices, 'Both batches should have been pushed').toHaveLength(7);

		const partitions = Map.groupBy(invoices, invoice => invoice.partition);

		partitions.forEach(series => {
			const indexes = series.map(invoice => invoice.index);
			expect(indexes, 'Expected a gapless sequence').toEqual(series.map((_, i) => i + 1));
		});

		const watermarks = await db.select().from(tables.sequencer);
		watermarks.map(mark => expect(mark.count).toBe(partitions.get(mark.partition)?.length));
	});
});
