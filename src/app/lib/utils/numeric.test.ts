import { assert, describe, expect, test } from 'vitest';

import { formatNumeric, isNumericString, NumericString } from '@/lib/utils/numeric';

describe('NumericString', () => {
	const accepted = [
		'0',
		'-0',
		'42',
		'-42',
		'01',
		'0.5',
		'0.1550',
		'999999999999999.99',
		// All accepted values should match NumericString type
	] as const satisfies readonly NumericString[];

	const rejected = [
		'',
		' 1',
		'1 ',
		'+1',
		'−42', // Minus sign
		'.5',
		'1.',
		'0o755',
		'1e3',
		'NaN',
		'Infinity',
		'-Infinity',
		'abc',
		'🐙',
		'0b10',
		'0B10',
		'0xFF',
		'0XFF',
		'0O755',
		'1E3',
		'1e+3',
		'1e-3',
		'1.1e3',
		// Rejected values can sometimes match NumericString type;
		// type is an ergonomic approximation, see TSDoc comment
	] as const;

	test.for(accepted)('Accepts numeric string: "%s"', value => {
		expect(isNumericString(value)).toBe(true);
		assert(isNumericString(value));
	});

	test.for(accepted)('Preserves decimal representation through parse: "%s" ', value => {
		// Ensures input does not coerce through JS number, losing precision
		expect(NumericString.parse(value)).toBe(value);
	});

	test.for(rejected)('Rejects invalid value: "%s"', value => {
		expect(isNumericString(value)).toBe(false);
		assert(!isNumericString(value));
	});

	test('Accepts decimal string above the JavaScript number range', () => {
		const value = '9'.repeat(600);
		expect(NumericString.parse(value)).toBe(value);
		expect(isNumericString(value)).toBe(true);
	});

	test('Accepts decimal string below the JavaScript number range', () => {
		const value = `0.${'0'.repeat(600)}1`;
		expect(NumericString.parse(value)).toBe(value);
		expect(isNumericString(value)).toBe(true);
	});
});

describe('formatNumeric', () => {
	const formatter = new Intl.NumberFormat('en-AU');

	test.for([
		[1234.5, '1,234.5'],
		['1234.5', '1,234.5'],
		['0.1550', '0.155'],
	] as const satisfies readonly (readonly [number | NumericString, string])[])(
		'Formats %j as %s',
		([value, expected]) => expect(formatNumeric(value, formatter)).toBe(expected),
	);

	test('Rejects invalid numeric string', () => {
		// @ts-expect-error Exercise the runtime guard
		expect(() => formatNumeric('abcd', formatter)).toThrow(`Invalid numeric value: abcd`);
	});

	// Intl.NumberFormat will internally round values, as maximumFractionDigits has a limited range
	// This does NOT demonstrate that output is processed beyond the max range
	test('Rounds string input above the JavaScript safe range', () => {
		const formatter = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 4 });
		expect(formatNumeric(NumericString.parse('9'.repeat(600)), formatter)).toBe('∞');
		expect(formatNumeric(NumericString.parse(`80.0${'8'.repeat(600)}`), formatter)).toBe('80.0889');
	});

	test('Rounds string input below the JavaScript safe range', () => {
		const formatter = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 4 });
		expect(formatNumeric(NumericString.parse(`0.${'0'.repeat(600)}1`), formatter)).toBe('0');
		expect(formatNumeric(NumericString.parse(`-${'9'.repeat(600)}`), formatter)).toBe('-∞');
	});
});
