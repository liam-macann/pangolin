import { eq, getTableName, sql } from 'drizzle-orm';
import { Temporal } from 'temporal-polyfill';
import { expect } from 'vitest';

import { keychain, sessions, users } from '@/db/schema';

import { type TestTX } from '@/test/pglite';
import { bypassRLS, createTestSession, asUser as test } from '@/test/session';

import { createSeeder } from './orchestrator';
import { owned, resetUser } from './reset';

/** Binds the seeders to a fixed history for a user. */
const seeder = (db: TestTX, userId: string) =>
	createSeeder({
		tx: db,
		userId,
		from: Temporal.Instant.from('2023-01-01T00:00:00Z'),
		to: Temporal.Instant.from('2026-03-15T02:30:00Z'),
	});

/** Counts the rows in each table, for a given user. */
async function countRows(db: TestTX, userId: string) {
	const tables = owned.map(table => [
		getTableName(table),
		db.$count(table, eq(table.userId, userId)),
	]);

	const [counts] = await db
		.select({
			keychain: db.$count(keychain, eq(keychain.id, userId)),
			...Object.fromEntries(tables),
		})
		.from(users)
		.where(eq(users.id, userId));

	return counts;
}

test('Deletes the data of one user only', async ({ db, auth, session }) => {
	const userId = session.user.id;
	const other = await createTestSession(auth);

	await bypassRLS(async () => {
		await seeder(db, userId).all();
		await seeder(db, other.user.id).all();

		const untouched = await countRows(db, other.user.id);

		await resetUser(db, userId);

		const remaining = Object.entries(await countRows(db, userId)).filter(([_, count]) => count > 0);
		expect(remaining).toEqual([]);

		expect(await countRows(db, other.user.id), 'Should not alter other users').toEqual(untouched);

		expect(await db.$count(sessions, eq(sessions.userId, userId)), 'Keeps user logged in').toBe(1);
	});
});

test('Refuses to reset database not marked as seedable', async ({ db, session }) => {
	const userId = session.user.id;

	await bypassRLS(async () => {
		await seeder(db, userId).all();
		const seeded = await countRows(db, userId);

		await db.execute(sql`COMMENT ON DATABASE postgres IS NULL`);

		await expect(resetUser(db, userId)).rejects.toThrow('is not marked as seedable');
		expect(await countRows(db, userId), 'Should not delete anything').toEqual(seeded);
	});
});
