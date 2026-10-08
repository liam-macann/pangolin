import { sql } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { asUser as test } from '@/test/session';

describe('checkDeferredConstraints', () => {
	test('Every deferrable constraint in the schema is INITIALLY DEFERRED', async ({ db }) => {
		// The reset is `SET CONSTRAINTS ALL DEFERRED`, which would wrongly defer an INITIALLY IMMEDIATE one
		const initiallyImmediate = await db
			.select({
				table: sql<string>`conrelid::regclass::text`,
				name: sql<string>`conname`,
			})
			.from(sql`pg_constraint`)
			.where(sql`condeferrable AND NOT condeferred`);

		expect(initiallyImmediate).toEqual([]);
	});
});
