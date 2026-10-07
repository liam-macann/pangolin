import { eq, sql } from 'drizzle-orm';
import { describe, expect, onTestFinished, vi } from 'vitest';

import { users } from '@/db/schema/auth';

import { type TestTX } from '@/test/pglite';
import { asUser, bypassRLS, testConnection } from '@/test/session';

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
