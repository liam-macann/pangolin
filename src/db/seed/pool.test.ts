import { base, en, Faker } from '@faker-js/faker';
import { describe, expect, test, vi } from 'vitest';

import { assertHistory, createPool } from './pool';
import { type SeedOptions } from './shared/context';

/** A pool over a seeder that returns only ID. */
const setup = () => {
	const faker = new Faker({ locale: [en, base] });
	faker.seed(42);

	const seeder = vi.fn(async (_ctx: null, { count = 5 }: SeedOptions = {}) =>
		faker.helpers.multiple(() => ({ id: faker.string.uuid() }), { count }),
	);

	const context = vi.fn(async () => null);
	const pool = createPool({
		run: task => task(),
		context,
		resolveNumberOrRange: count => (typeof count === 'number' ? count : count.min),
	})(seeder);
	return { pool, seeder, context };
};

describe('pool', () => {
	test('Resolves zero before creating context, preserving the empty pool', async () => {
		const { pool, seeder, context } = setup();

		expect(await pool.add({ count: { min: 0, max: 1 } })).toEqual([]);
		expect(await pool.ensure()).toEqual([]);
		expect(pool.declined()).toBe(true);
		expect(context).not.toHaveBeenCalled();
		expect(seeder).not.toHaveBeenCalled();

		expect(await pool.ensure({ count: 1 })).toHaveLength(1);
		expect(pool.declined()).toBe(false);
	});

	test('Adds nothing when seeded count falls within requested range', async () => {
		const { pool, seeder } = setup();
		const rows = await pool.add({ count: 3 });

		expect(await pool.ensure({ count: { min: 1, max: 400 } })).toEqual(rows);
		expect(await pool.ensure()).toEqual(rows);
		expect(seeder).toHaveBeenCalledOnce();
	});

	test('Bridges a shortfall, refusing an already exceeded count', async () => {
		const { pool } = setup();
		await pool.add({ count: 3 });

		// Plain number is treated as a minimum
		expect(await pool.ensure({ count: 2 })).toHaveLength(3);

		// Explicit range has min/max semantics
		await expect(pool.ensure({ count: { min: 0, max: 2 } })).rejects.toThrow('Already seeded 3');

		const range = await pool.ensure({ count: { min: 4, max: 8 } });
		expect(range.length).toBeGreaterThanOrEqual(4);
		expect(range.length).toBeLessThanOrEqual(8);

		expect(await pool.ensure({ count: 10 })).toHaveLength(10);
	});

	test.for([0, { min: 0, max: 0 }])(
		'Preserves an explicitly empty pool until added to (case %$)',
		async count => {
			const { pool, seeder } = setup();

			expect(await pool.add({ count })).toEqual([]);
			expect(await pool.ensure(), 'Defaults should not fill an emptied pool').toEqual([]);
			expect(pool.declined()).toBe(true);
			expect(seeder).not.toHaveBeenCalled();

			expect(await pool.ensure({ count: 2 })).toHaveLength(2);
			expect(pool.declined()).toBe(false);
		},
	);

	test('Counts a row once (by ID), however often a seeder returns it', async () => {
		const reused = [{ id: 'a' }, { id: 'b' }];

		const pool = createPool({
			run: task => task(),
			context: async () => null,
			resolveNumberOrRange: count => (typeof count === 'number' ? count : count.min),
		})(async () => reused);

		await pool.add();
		await pool.add();

		expect(pool.list()).toEqual(reused);
	});

	test('Returns cloned rows, not the internal array reference', async () => {
		const { pool } = setup();
		const rows = await pool.ensure({ count: 2 });

		rows.length = 0;
		expect(pool.list()).toHaveLength(2);
	});
});

describe('assertHistory', () => {
	test('Accepts a history within the requested versions, refusing any other', () => {
		expect(() => assertHistory([5, 2], 2)).not.toThrow(); // Plain number is treated as a minimum
		expect(() => assertHistory([5, 2], { min: 1, max: 5 })).not.toThrow();

		expect(() => assertHistory([5, 2], 3)).toThrow('cannot be recut');
		expect(() => assertHistory([5], { min: 0, max: 2 })).toThrow('Already seeded 5');
	});
});
