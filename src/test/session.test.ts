import { eq, sql } from 'drizzle-orm';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, onTestFinished, vi } from 'vitest';

import { withRLS } from '@/db';
import { clients } from '@/db/schema';
import { users } from '@/db/schema/auth';

import { type TestTX } from '@/test/pglite';
import { asUser, bypassRLS, createTestSession, testConnection } from '@/test/session';

describe('bypassRLS', () => {
	const currentRole = async (db: TestTX) => {
		const { rows } = await db.execute<{ role: string }>(sql`SELECT current_user AS role`);
		return rows[0]?.role;
	};

	asUser('Runs the callback as the superuser role, and returns its result', async ({ db }) => {
		expect(await bypassRLS(() => currentRole(db))).toBe('neondb_owner');
	});

	asUser('Restores the authenticated role afterwards', async ({ db }) => {
		await bypassRLS(async () => {});
		expect(await currentRole(db)).toBe('authenticated');
	});

	asUser('Restores the authenticated role when the callback throws or rejects', async ({ db }) => {
		const error = new Error('Callback failed');

		// biome-ignore format: Keep on one line
		await expect(bypassRLS(() => { throw error; })).rejects.toBe(error);
		expect(await currentRole(db)).toBe('authenticated');

		// Async rejection
		await expect(bypassRLS(() => Promise.reject(error))).rejects.toBe(error);
		expect(await currentRole(db)).toBe('authenticated');
	});

	asUser('Throws when called outside of a test environment', async ({ db }) => {
		const nodeEnv = process.env.NODE_ENV;
		vi.stubEnv('NODE_ENV', 'production');
		onTestFinished(() => void vi.stubEnv('NODE_ENV', nodeEnv));
		const callback = vi.fn(async () => {});

		await expect(bypassRLS(callback)).rejects.toThrow('only available in tests');

		expect(callback).not.toHaveBeenCalled();
		expect(await currentRole(db)).toBe('authenticated');
	});

	describe('Nesting', () => {
		asUser('Stays superuser after a nested call returns', async ({ db }) => {
			const roles = await bypassRLS(async () => {
				const inner = await bypassRLS(() => currentRole(db));
				return { inner, outer: await currentRole(db) };
			});

			expect(roles).toEqual({ inner: 'neondb_owner', outer: 'neondb_owner' });
			expect(await currentRole(db)).toBe('authenticated');
		});

		asUser('Stays superuser after a nested call rejects', async ({ db }) => {
			const error = new Error('Callback failed');

			const outer = await bypassRLS(async () => {
				await expect(bypassRLS(() => Promise.reject(error))).rejects.toBe(error);
				return currentRole(db);
			});

			expect(outer).toBe('neondb_owner');
			expect(await currentRole(db)).toBe('authenticated');
		});

		asUser('Stays superuser after a nested call throws synchronously', async ({ db }) => {
			const error = new Error('Callback failed');

			const outer = await bypassRLS(async () => {
				// biome-ignore format: Keep on one line
				await expect(bypassRLS(() => { throw error; })).rejects.toBe(error);
				return currentRole(db);
			});

			expect(outer).toBe('neondb_owner');
			expect(await currentRole(db)).toBe('authenticated');
		});
	});

	describe('Inside withRLS()', () => {
		/** Reads every client id the acting user can reach through `withRLS()` */
		const visibleClients = () =>
			withRLS(tx => tx.select({ id: clients.id }).from(clients)).then(rows => rows.map(r => r.id));

		asUser('Bypasses RLS for the duration of the callback only', async ({ auth, seed }) => {
			const other = await createTestSession(auth);
			const [theirs] = await seed({ userId: other.user.id }).clients({ count: 1 });

			expect(await visibleClients()).toEqual([]);
			expect(await bypassRLS(() => visibleClients())).toEqual([theirs.id]);
			expect(await visibleClients()).toEqual([]);
		});

		asUser('Stays bypassed after a nested call returns', async ({ auth, seed }) => {
			const other = await createTestSession(auth);
			const [theirs] = await seed({ userId: other.user.id }).clients({ count: 1 });

			const outer = await bypassRLS(async () => {
				await bypassRLS(async () => {});
				return visibleClients();
			});

			expect(outer).toEqual([theirs.id]);
			expect(await visibleClients()).toEqual([]);
		});
	});

	asUser('Throws without a test transaction', async () => {
		await expect(testConnection.exit(() => bypassRLS(async () => {}))).rejects.toThrow(
			'without a test database',
		);
	});
});

// This is a meta-test to ensure the database isolation functions correctly in the asUser fixtures

// DO NOT REORDER OR USE .concurrent: Test B strictly relies on the aftermath of Test A
describe('asUser fixture rollback', { concurrent: false }, () => {
	const email = 'rollback-verification-123@example.com';

	asUser('A: Inserts a row into an existing table', async ({ db }) => {
		const rows = await bypassRLS(async () => {
			await db.insert(users).values({ name: 'Isolation Test', email });
			return db.select().from(users).where(eq(users.email, email));
		});

		expect(rows.length).toBe(1);
	});

	asUser('B: Verifies the previous test was completely rolled back', async ({ db }) => {
		const { all, inserted } = await bypassRLS(async () => ({
			all: await db.select().from(users),
			inserted: await db.query.users.findFirst({ where: { email } }),
		}));

		// The session fixture will insert a user on each test. The previous session should have been rolled back.
		expect(all.length).toBe(1);

		// The additional user inserted in this suite should be rolled back.
		expect(inserted).toBeUndefined();
	});
});

describe('asUser seed fixture', () => {
	asUser('Repeated calls continue seeding the same user', async ({ seed }) => {
		// A second seeder bound to the user would refuse them, as they already have data
		const [client] = await seed().clients({ count: 1 });
		const invoices = await seed.invoices({ count: 2 });

		expect(invoices).toHaveLength(2);
		expect((await seed().all()).clients.map(c => c.id)).toEqual([client.id]);
	});

	asUser('Applies options given on first use to all subsequent calls', async ({ seed }) => {
		const from = Temporal.Instant.from('2024-06-01T00:00:00Z');

		// The first config version begins at the start of the seeded history
		const [config] = await seed({ from }).config({ versions: 1 });
		expect(Temporal.Instant.from(config.validFrom).equals(from)).toBe(true);

		// This call should inherit options
		const [clients] = await seed().clients({ count: 1 });
		expect(Temporal.Instant.from(clients.versions[0].validFrom).equals(from)).toBe(true);
	});

	asUser('Property access leaves the seeder unbound until called', async ({ seed }) => {
		const { clients } = seed;
		const from = Temporal.Instant.from('2024-06-01T00:00:00Z');

		// Would be refused if reading the property had already bound a seeder
		seed({ from });

		const [client] = await clients({ count: 1 });
		expect(Temporal.Instant.from(client.versions[0].validFrom).equals(from)).toBe(true);
	});

	asUser('Refuses options for a seeder that is already bound', async ({ seed }) => {
		seed();
		expect(() => seed({ seed: 1 })).toThrow('already bound');
	});

	asUser('Binds a separate seeder to each user', async ({ auth, session, seed }) => {
		const other = await createTestSession(auth);

		const [mine] = await seed().clients({ count: 1 });
		const [theirs] = await seed({ userId: other.user.id }).clients({ count: 1 });

		expect(mine.userId).toBe(session.user.id);
		expect(theirs.userId).toBe(other.user.id);
		expect(seed({ userId: other.user.id })).toBe(seed({ userId: other.user.id }));
		expect(seed()).not.toBe(seed({ userId: other.user.id }));
	});
});
