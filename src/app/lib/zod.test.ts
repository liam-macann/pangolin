import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { arrayBounds, intlNumber, numberBounds } from '@/lib/zod';

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
			expect(schema.parse(input)).toBeCloseTo(1234567.89),
		);

		test.for<[string, number]>([
			['3.14', 3.14],
			['1.5', 1.5],
		])('Parses period-decimal %s', ([input, expected]) =>
			expect(schema.parse(input)).toBeCloseTo(expected),
		);

		test.for<[string, number]>([
			['3,14', 3.14],
			['1,5', 1.5],
		])('Parses comma-decimal %s', ([input, expected]) =>
			expect(schema.parse(input)).toBeCloseTo(expected),
		);

		// Multiple separators implies not a decimal separator
		test.for(['12,345,678', '12.345.678', '12 345 678', "12'345'678"])(
			'Handles separators in integer value: %s',
			input => expect(schema.parse(input)).toBe(12345678),
		);

		// Mixed ordering of separators
		test.for(['2.00,0.800.99', '2,00,0.800,99'])(
			'Rejects when unable to infer decimal separator: %s',
			input => {
				expect(() => schema.parse(input)).toThrow();
			},
		);

		test('Handles surrounding whitespace', () => {
			expect(schema.parse(' 42 ')).toBe(42);
			expect(schema.parse('3.14 ')).toBeCloseTo(3.14);
			// Non-standard whitespace characters
			expect(schema.parse('  -23,14 ')).toBeCloseTo(-23.14);
		});
	});

	test.for(['abcd', 'e', '3e'])('Rejects alphanumeric input', input =>
		expect(() => schema.parse(input)).toThrow(),
	);

	test('Rejects empty string', () => expect(() => schema.parse('')).toThrow());

	describe('Number inputs', () => {
		test.for([42, 3.14, 0, -4398])('Passes through %s unchanged', n =>
			expect(schema.parse(n)).toBeCloseTo(n),
		);
	});

	test('Returns custom error message', () => {
		const message = 'Please enter a number';
		expect(intlNumber(message).safeParse('').error?.issues[0].message).toBe(message);
	});
});

describe('numberBounds', () => {
	test('Reads min/max off a bounded number schema', () => {
		expect(numberBounds(z.number().min(2).max(5))).toEqual({ minValue: 2, maxValue: 5 });
		expect(numberBounds(z.number().min(1).max(10).optional().nullable())).toEqual({
			minValue: 1,
			maxValue: 10,
		});
	});

	test('Defaults missing bounds to ±Infinity', () => {
		expect(numberBounds(z.number().min(2))).toEqual({ minValue: 2, maxValue: Infinity });
		expect(numberBounds(z.number().max(2))).toEqual({ minValue: -Infinity, maxValue: 2 });
	});

	test('Throws when no bounded number is present', () => {
		expect(() => numberBounds(z.number())).toThrow();
	});
});

describe('arrayBounds', () => {
	test('Reads min/max off a bounded array schema', () => {
		expect(arrayBounds(z.array(z.string()).min(2).max(5))).toEqual({
			minLength: 2,
			maxLength: 5,
		});
		expect(arrayBounds(z.array(z.string()).min(1).max(3).optional().nullable())).toEqual({
			minLength: 1,
			maxLength: 3,
		});
	});

	test('Defaults missing bounds to Infinity (max) and 0 (min)', () => {
		expect(arrayBounds(z.array(z.string()).min(1))).toEqual({
			minLength: 1,
			maxLength: Infinity,
		});
		expect(arrayBounds(z.array(z.string()).max(1))).toEqual({
			minLength: 0,
			maxLength: 1,
		});
	});

	test('Throws when no bounded array is present', () => {
		expect(() => arrayBounds(z.array(z.string()))).toThrow();
	});
});
