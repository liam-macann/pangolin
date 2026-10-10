import { base, en, Faker } from '@faker-js/faker';
import { Temporal } from 'temporal-polyfill';
import { describe, expect } from 'vitest';

import * as tables from '@/db/schema';
import { seedKeychain } from '@/db/seed/entities/encrypt';
import { type SeedContext } from '@/db/seed/shared/context';

import { bypassRLS, asUser as test } from '@/test/session';

import { seedTaxes } from './taxes';

test.aroundEach(async runTest => bypassRLS(() => runTest()));

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

describe('seedTaxes', () => {
	test('Returns an empty batch when no taxes are requested', async ({ db, session }) => {
		const ctx = await createSeedContext(db, session.user.id);

		expect(await seedTaxes(ctx, { count: 0 })).toEqual([]);
		expect(await db.$count(tables.taxes)).toBe(0);
	});

	test('Reuses extant taxes, returned in the requested order', async ({ db, session }) => {
		const ctx = await createSeedContext(db, session.user.id);
		const first = await seedTaxes(ctx, {
			count: 3,
			overrides: [
				{ name: 'GST', rate: '0.1000' },
				{ name: 'VAT', rate: '0.12345' }, // Checks precision rounding
				{ name: 'GST', rate: '0.2000' },
			],
		});

		// These taxes are already in the database, and should be reused
		const repeated = await seedTaxes(ctx, {
			count: 3,
			overrides: [
				{ name: 'GST', rate: '0.2' },
				{ name: 'GST', rate: '0.1' },
				{ name: 'VAT', rate: '0.1235' },
			],
		});

		expect(repeated, 'Order should match this request').toEqual([first[2], first[0], first[1]]);
		expect(await db.$count(tables.taxes)).toBe(3);
	});
});
