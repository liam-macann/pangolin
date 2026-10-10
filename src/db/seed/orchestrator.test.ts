import { type NumberOrRange } from '@faker-js/faker';
import { sql } from 'drizzle-orm';
import { Temporal } from 'temporal-polyfill';
import { describe, expect } from 'vitest';

import { fetchInvoice, fetchInvoices } from '@/lib/data/invoice';
import * as tables from '@/db/schema';

import { type TestTX } from '@/test/pglite';
import { bypassRLS, createTestSession, asUser as test } from '@/test/session';

import { createSeeder } from './orchestrator';
import { owned, resetUser } from './reset';

test.aroundEach(async runTest => bypassRLS(() => runTest()));

const seeder = (db: TestTX, userId: string, seed = 42) =>
	createSeeder({
		tx: db,
		userId,
		seed,
		from: Temporal.Instant.from('2023-01-01T00:00:00Z'),
		to: Temporal.Instant.from('2026-03-15T02:30:00Z'),
	});

describe('createSeeder', () => {
	test('Refuses to seed a database that is not marked as seedable', async ({ db, session }) => {
		await db.execute(sql`COMMENT ON DATABASE postgres IS NULL`);
		await expect(seeder(db, session.user.id).all()).rejects.toThrow('is not marked as seedable');
		expect(await db.$count(tables.invoices)).toBe(0);
	});

	test('Seeds as many of each entity is asked for', async ({ db, session }) => {
		const seeded = await seeder(db, session.user.id).all({
			config: { versions: 2 },
			clients: { count: 2, versions: 3 },
			invoices: { count: 4 },
		});

		expect(seeded.configs).toHaveLength(2);
		expect(seeded.clients.map(client => client.versions.length)).toEqual([3, 3]);
		expect(seeded.invoices).toHaveLength(4);

		// Ensures invoices are relationally complete, and can be read through the application
		expect(await fetchInvoices({ limit: 200 })).toHaveLength(4);
		const invoice = await fetchInvoice(seeded.invoices[0].id);
		expect(invoice.items.length).toBeGreaterThan(0);
	});

	test.for([0, 1, 2, 3, 4, 5])(
		'Seeds a complete default history from seed %i',
		async (seed, { db, session }) => {
			const seeded = await seeder(db, session.user.id, seed).all();

			expect(seeded.taxes.length).toBeGreaterThan(0);
			expect(seeded.configs.length).toBeGreaterThan(0);
			expect(seeded.clients.length).toBeGreaterThan(0);
			expect(seeded.invoices.length).toBeGreaterThan(0);

			// Every invoice written is readable through the application
			expect(await fetchInvoices({ limit: 200 })).toHaveLength(
				Math.min(seeded.invoices.length, 200),
			);
		},
	);

	test('Adds nothing when seeded count falls within requested range', async ({ db, session }) => {
		const seed = seeder(db, session.user.id);
		const clients = await seed.clients({ count: 3, versions: 1 });

		const result = await seed.all({
			clients: { count: { min: 1, max: 400 } },
			invoices: { count: 0 },
		});

		expect(result.clients).toEqual(clients);
		expect(await db.$count(tables.clients)).toBe(3);
	});

	test('Bridges a shortfall, refusing an already exceeded count', async ({ db, session }) => {
		const seed = seeder(db, session.user.id);
		await seed.clients({ count: 3, versions: 5 });

		const all = (n: NumberOrRange, v?: NumberOrRange) =>
			seed.all({ clients: { count: n, versions: v } });

		// Plain number is treated as a minimum
		await expect(all(2, 2)).resolves.not.toThrow();

		// Explicit range has min/max semantics
		await expect(all({ min: 0, max: 2 })).rejects.toThrow('Already seeded 3'); // Logical count
		await expect(all(3, { min: 0, max: 2 })).rejects.toThrow('Already seeded 5'); // Version count

		// Automatically seeds a shortfall (you cannot recut version history, so only logical count)
		const range = await all({ min: 4, max: 8 });
		expect(range.clients.length).toBeGreaterThanOrEqual(4);
		expect(range.clients.length).toBeLessThanOrEqual(8);

		expect((await all(10)).clients).toHaveLength(10);
	});

	test('Refuses to extend existing version histories', async ({ db, session }) => {
		// History is distributed over a range (bound at init).
		// You cannot prepend without extending that range backwards.
		// You cannot append without extending that range forwards.

		const seed = seeder(db, session.user.id);
		await seed.config({ versions: 2 });
		await seed.clients({ count: 1, versions: 2 });

		await expect(seed.config({ versions: 3 })).rejects.toThrow('history cannot be recut');
		await expect(seed.all({ clients: { versions: 3 } })).rejects.toThrow('history cannot be recut');
	});

	test('Reuses existing version histories', async ({ db, session }) => {
		const seed = seeder(db, session.user.id);
		const config = await seed.config({ versions: 2 });
		const clients = await seed.clients({ count: 1, versions: 2 });

		// Requested versions are lower than existing cut, so satisfy .ensures() call
		expect(await seed.config({ versions: 1 })).toEqual(config);
		expect(await seed.config({ versions: { min: 1, max: 30 } })).toEqual(config);

		expect(await seed.config()).toEqual(config);
		expect((await seed.all({ invoices: { count: 0 } })).clients).toEqual(clients);
	});

	test('Empty seed counts write nothing', async ({ db, session }) => {
		const seed = seeder(db, session.user.id);

		expect(await seed.taxes({ count: 0 })).toEqual([]);
		expect(await seed.clients({ count: 0 })).toEqual([]);
		expect(await seed.invoices({ count: 0 })).toEqual([]);
		await expect(seed.config({ versions: 0 })).rejects.toThrow('must contain at least one version');

		await expect(
			seed.all({
				taxes: { count: 0 },
				clients: { count: 0 },
				invoices: { count: 0 },
				config: { versions: 0 },
			}),
		).rejects.toThrow('must contain at least one version');

		for (const table of owned) expect(await db.$count(table)).toBe(0);
	});

	test('Preserves explicitly empty pools on subsequent default calls', async ({ db, session }) => {
		const seed = seeder(db, session.user.id);
		const first = await seed.all({
			taxes: { count: 0 },
			clients: { count: 0 },
			invoices: { count: 0 },
			config: { versions: 1 },
		});

		expect(first).toMatchObject({ taxes: [], clients: [], invoices: [] });
		expect(await seed.all()).toEqual(first);
		expect(await db.$count(tables.taxes)).toBe(0);
		expect(await db.$count(tables.clients)).toBe(0);
		expect(await db.$count(tables.invoices)).toBe(0);
	});

	test('Scopes seeded entities to their owning users', async ({ db, auth, session }) => {
		const other = await createTestSession(auth);
		const [mine] = await seeder(db, session.user.id).clients({ count: 1, versions: 1 });
		const [theirs] = await seeder(db, other.user.id, 43).clients({ count: 1, versions: 1 });

		expect(mine.userId).toBe(session.user.id);
		expect(mine.versions[0].userId).toBe(session.user.id);

		expect(theirs.userId).toBe(other.user.id);
		expect(theirs.versions[0].userId).toBe(other.user.id);

		expect(await db.$count(tables.clients)).toBe(2);
	});

	test('Reproduces the same data from the same seed', async ({ db, session }) => {
		const options = { count: 2, versions: 2 };
		const first = await seeder(db, session.user.id).clients(options);

		await resetUser(db, session.user.id);
		const repeated = await seeder(db, session.user.id).clients(options);

		expect(repeated).toEqual(first);
	});

	test('Adds invoice batches with gapless numbering', async ({ db, session }) => {
		const seed = seeder(db, session.user.id);
		expect(await seed.invoices({ count: 3 })).toHaveLength(3);
		expect(await seed.invoices({ count: 4 })).toHaveLength(4);

		const invoices = await db
			.select({ partition: tables.invoices.partition, index: tables.invoices.index })
			.from(tables.invoices)
			.orderBy(tables.invoices.index);

		expect(invoices, 'Both batches should have been pushed').toHaveLength(7);

		const partitions = Map.groupBy(invoices, invoice => invoice.partition);

		partitions.forEach(series => {
			const indexes = series.map(invoice => invoice.index);
			expect(indexes, 'Expected a gapless sequence').toEqual(series.map((_, i) => i + 1));
		});

		const watermarks = await db
			.select({ partition: tables.sequencer.partition, count: tables.sequencer.count })
			.from(tables.sequencer);

		expect(watermarks, 'Every partition should have a watermark').toHaveLength(partitions.size);
		watermarks.map(mark => expect(mark.count).toBe(partitions.get(mark.partition)?.length));
	});

	test('Returns cloned rows, not the internal array reference', async ({ db, session }) => {
		const seed = seeder(db, session.user.id);
		const { clients } = await seed.all({
			clients: { count: 2, versions: 1 },
			invoices: { count: 0 },
		});

		await seed.clients({ count: 1, versions: 1 });
		expect(clients).toHaveLength(2);

		clients.length = 0;
		expect((await seed.all({ invoices: { count: 0 } })).clients).toHaveLength(3);
		expect(await db.$count(tables.clients)).toBe(3);
	});
});
