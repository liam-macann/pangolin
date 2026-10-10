import { sql } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { bypassRLS, asUser as test } from '@/test/session';

import { assertSeedable } from './guard';

/** Overrides the comment of the test database, which starts marked as seedable. */
const commentDatabase = (comment: string | null) =>
	bypassRLS(db => {
		return db.execute(
			sql`COMMENT ON DATABASE postgres IS ${sql.raw(comment === null ? 'NULL' : `'${comment}'`)}`,
		);
	});

describe('assertSeedable', () => {
	test('Refuses a database that carries no mark', async ({ db }) => {
		await commentDatabase(null);
		await expect(assertSeedable(db)).rejects.toThrow('is not marked as seedable');
	});

	test.for(['production', 'Seedable', 'not seedable'])(
		'Refuses a database commented "%s"',
		async (comment, { db }) => {
			await commentDatabase(comment);
			await expect(assertSeedable(db)).rejects.toThrow('is not marked as seedable');
		},
	);

	test.for(['seedable', ' seedable '])(
		'Accepts a database commented "%s"',
		async (comment, { db }) => {
			await commentDatabase(comment);
			await expect(assertSeedable(db)).resolves.toBeUndefined();
		},
	);
});
