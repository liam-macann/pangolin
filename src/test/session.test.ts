import { eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { users } from '@/db/schema/auth';

import { asUser as test } from '@/src/test/session';

// This is a meta-test to ensure the database isolation functions correctly in the asUser fixtures

// DO NOT REORDER OR USE .concurrent: Test B strictly relies on the aftermath of Test A
describe('asUser fixture rollback', () => {
	const email = 'rollback-verification-123@example.com';

	test('A: Inserts a row into an existing table', async ({ db }) => {
		await db.insert(users).values({ name: 'Isolation Test', email });

		const rows = await db.select().from(users).where(eq(users.email, email));
		expect(rows.length).toBe(1);
	});

	test('B: Verifies the previous test was completely rolled back', async ({ db }) => {
		// The session fixture will insert a user on each test. The previous session should have been rolled back.
		expect((await db.select().from(users)).length).toBe(1);

		// The additional user inserted in this suite should be rolled back.
		expect(await db.query.users.findFirst({ where: { email } })).toBeUndefined();
	});
});
