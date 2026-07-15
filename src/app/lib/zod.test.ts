import { describe, expect, test } from 'vitest';

import { intlNumber } from '@/lib/zod';

describe('intlNumber', () => {
	const schema = intlNumber();

	describe('Coerces string to number', () => {
		test.for<[string, number]>([
			['-42', -42],
			['42', 42],
			['0', 0],
		])('Parses %s as integer', ([input, expected]) => expect(schema.parse(input)).toBe(expected));

		test.for([
			'1234 567,89',
			'1234 567.89',
			'1,234,567.89',
			'1,234,567.89',
			'1.234.567,89',
			"1'234'567.89",
			'12,34,567.89',
			'123,4567.89',
			'123,,,45,,67.89',
			'123.45...67,89',
		])('Strips thousands separators from decimal: %s', input =>
			expect(schema.parse(input)).toBeCloseTo(1234567.89));

		test.for<[string, number]>([
			['3.14', 3.14],
			['1.5', 1.5],
		])('Parses period-decimal %s', ([input, expected]) =>
			expect(schema.parse(input)).toBeCloseTo(expected));

		test.for<[string, number]>([
			['3,14', 3.14],
			['1,5', 1.5],
		])('Parses comma-decimal %s', ([input, expected]) =>
			expect(schema.parse(input)).toBeCloseTo(expected));

		// Multiple separators implies not a decimal separator
		test.for([
			'12,345,678',
			'12.345.678',
			'12 345 678',
			"12'345'678",
		])('Handles separators in integer value: %s', input =>
			expect(schema.parse(input)).toBe(12345678));

		// Mixed ordering of separators
		test.for([
			'2.00,0.800.99',
			'2,00,0.800,99',
		])('Rejects when unable to infer decimal separator: %s', input => {
			expect(() => schema.parse(input)).toThrow();
		});

		test('Handles surrounding whitespace', () => {
			expect(schema.parse(' 42 ')).toBe(42);
			expect(schema.parse('3.14 ')).toBeCloseTo(3.14);
			// Non-standard whitespace characters
			expect(schema.parse('  -23,14 ')).toBeCloseTo(-23.14);
		});
	});

	test.for(['abcd', 'e', '3e'])('Rejects alphanumeric input', input =>
		expect(() => schema.parse(input)).toThrow());

	test('Rejects empty string', () => expect(() => schema.parse('')).toThrow());

	describe('Number inputs', () => {
		test.for([42, 3.14, 0, -4398])('Passes through %s unchanged', n =>
			expect(schema.parse(n)).toBeCloseTo(n));
	});

	test('Returns custom error message', () => {
		const message = 'Please enter a number';
		expect(intlNumber(message).safeParse('').error?.issues[0].message).toBe(message);
	});
});
