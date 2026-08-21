import { sql } from 'drizzle-orm';
import { char, check, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { describe, expect, test } from 'vitest';

import { getTextColumnBounds } from '@/lib/utils/drizzle';

describe('getTextColumnBounds()', () => {
	const t = pgTable(
		'drizzle_bounds',
		{
			varchar: varchar({ length: 12 }),
			char: char({ length: 4 }),
			unboundedText: text(),
			checkedText: text(),
			exactText: text(),
			constrainedVarchar: varchar({ length: 12 }),
		},
		t => [
			check('test_checked_text_min', sql`char_length(${t.checkedText}) >= 2`),
			check('test_checked_text_max', sql`length(${t.checkedText}) <= 8`),
			check('test_exact_text_length', sql`character_length(${t.exactText}) = 3`),
			check('test_constrained_varchar_min', sql`length(${t.constrainedVarchar}) >= 2`),
			check('test_constrained_varchar_max', sql`char_length(${t.constrainedVarchar}) <= 8`),
		],
	);

	test('Uses VARCHAR length', () =>
		expect(getTextColumnBounds(t.varchar)).toEqual({ minLength: 0, maxLength: 12 }));

	test('Uses CHAR length', () =>
		expect(getTextColumnBounds(t.char)).toEqual({ minLength: 0, maxLength: 4 }));

	test('Allows unbounded text', () =>
		expect(getTextColumnBounds(t.unboundedText)).toEqual({ minLength: 0, maxLength: Infinity }));

	test('Combines minimum and maximum checks', () =>
		expect(getTextColumnBounds(t.checkedText)).toEqual({ minLength: 2, maxLength: 8 }));

	test('Uses exact length equality checks', () =>
		expect(getTextColumnBounds(t.exactText)).toEqual({ minLength: 3, maxLength: 3 }));

	test('Combines type and check bounds', () =>
		expect(getTextColumnBounds(t.constrainedVarchar)).toEqual({ minLength: 2, maxLength: 8 }));
});
