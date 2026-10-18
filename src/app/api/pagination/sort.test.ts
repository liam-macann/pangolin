import { describe, expect, test } from 'vitest';

import { sortParam } from './sort';

describe('sortParam()', () => {
	const schema = sortParam(['position', 'label', 'other']);

	test('Parses terms most significant first, keeping the first of a repeated field', () => {
		const sort = schema.parse(['label', '-position', '-label']);

		expect(Object.entries(sort)).toEqual([
			['label', 'asc'],
			['position', 'desc'],
		]);
	});

	test('Limits sort array length to the number of sortable fields', () => {
		const long = ['position', 'label', 'other', 'status', 'amount'];
		const short = long.slice(0, 2);

		const shortRes = sortParam(short).safeParse([...short, '-position']);
		expect(shortRes.error?.issues[0]).toMatchObject({ code: 'too_big', maximum: short.length });

		const longRes = sortParam(long).safeParse([...long, '-position']);
		expect(longRes.error?.issues[0]).toMatchObject({ code: 'too_big', maximum: long.length });
	});

	test('Refuses a field name that the parameter could not be read back from', () => {
		expect(() => sortParam(['-position'])).toThrow('contain a comma or start with a minus');
		expect(() => sortParam(['position,label'])).toThrow('contain a comma or start with a minus');
	});

	test('Rejects an unknown sort field', async () => {
		const result = await schema.safeParseAsync(['unknown']);
		expect(result.success).toBe(false);
	});
});
