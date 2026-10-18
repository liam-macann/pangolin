import { eq, type SQL, sql } from 'drizzle-orm';
import { assert, expect } from 'vitest';

import * as tables from '@/db/schema';

import { bypassRLS, asUser as test } from '@/test/session';

import { isUnicode } from './types';

test('Sorts unicode() columns in Unicode order, not byte order', async ({ seed, session }) => {
	const names = ['zebra', 'Éclair', 'apple', 'Banana'];
	await seed.clients({ versions: 1, overrides: names.map(name => ({ data: { name } })) });

	const { displayName } = tables.clientData;
	assert(isUnicode(displayName), 'Column is incidental: we just need a definition with unicode()');

	const sortBy = async (order?: SQL) =>
		await bypassRLS(tx =>
			tx
				.select({ displayName })
				.from(tables.clientData)
				.where(eq(tables.clientData.userId, session.user.id))
				.orderBy(order ?? displayName),
		).then(rows => rows.map(row => row.displayName));

	expect(await sortBy()).toEqual(['apple', 'Banana', 'Éclair', 'zebra']);

	// Control: the same names in byte order
	expect(await sortBy(sql`${displayName} COLLATE "C"`)).toEqual([
		'Banana',
		'apple',
		'zebra',
		'Éclair',
	]);
});
