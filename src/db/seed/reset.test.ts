import { eq, getTableName, sql } from 'drizzle-orm';
import { expect } from 'vitest';

import { keychain, sessions, users } from '@/db/schema';

import { type TestTX } from '@/test/pglite';
import { bypassRLS, createTestSession, asUser as test } from '@/test/session';

import { owned, resetUser } from './reset';

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

test('Deletes the data of one user only', async ({ db, auth, session, seed }) => {
	const userId = session.user.id;
	const other = await createTestSession(auth);

	await bypassRLS(async () => {
		await seed.all();
		await seed({ userId: other.user.id }).all();

		const untouched = await countRows(db, other.user.id);

		await resetUser(db, userId);

		const remaining = Object.entries(await countRows(db, userId)).filter(([_, count]) => count > 0);
		expect(remaining).toEqual([]);

		expect(await countRows(db, other.user.id), 'Should not alter other users').toEqual(untouched);

		expect(await db.$count(sessions, eq(sessions.userId, userId)), 'Keeps user logged in').toBe(1);
	});
});

test('Refuses to reset database not marked as seedable', async ({ db, session, seed }) => {
	const userId = session.user.id;

	await bypassRLS(async () => {
		await seed.all();
		const seeded = await countRows(db, userId);

		await db.execute(sql`COMMENT ON DATABASE postgres IS NULL`);

		await expect(resetUser(db, userId)).rejects.toThrow('is not marked as seedable');
		expect(await countRows(db, userId), 'Should not delete anything').toEqual(seeded);
	});
});
