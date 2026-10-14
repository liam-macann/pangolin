import { sql } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { invoices } from '@/db/schema';

import { asUser as test } from '@/test/session';

import { authUid } from './_helpers';

describe('authUid()', () => {
	test('Checks the user once per query, not once per row', async ({ db }) => {
		const query = db.select().from(invoices).where(authUid(invoices.userId));

		const { rows } = await db.execute<{ 'QUERY PLAN': string }>(sql`EXPLAIN ${query}`);
		const plan = rows.map(row => row['QUERY PLAN']).join('\n');

		expect(plan).toContain('InitPlan');
		expect(plan).not.toContain('SubPlan');
	});
});
