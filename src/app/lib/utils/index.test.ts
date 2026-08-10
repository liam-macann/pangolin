import { describe, expect, test } from 'vitest';

import { invoiceReference, percentToRate, pluralize, rateToPercent } from '@/lib/utils';

describe('invoiceReference', () => {
	test('Does not allow negative indices', () =>
		expect(() => invoiceReference({ index: -1, partition: null }, 'sequential')).toThrow(
			'Index must be non-negative',
		));

	test('Does not truncate indices beyond 3 digits', () => {
		expect(invoiceReference({ index: 4200, partition: null }, 'sequential')).toBe('INV-4200');
		expect(invoiceReference({ index: 4200, partition: '2025' }, 'annual')).toBe('2025-4200');
	});

	describe('Sequential scheme', () => {
		test.for([
			{ index: 1, expected: 'INV-001' },
			{ index: 42, expected: 'INV-042' },
		])('Formats: $index → $expected', ({ index, expected }) =>
			expect(invoiceReference({ index, partition: null }, 'sequential')).toBe(expected));
	});

	describe('Annual scheme', () => {
		test.for([
			{ index: 1, expected: '2025-001' },
			{ index: 42, expected: '2025-042' },
		])('Formats: index → $expected', ({ index, expected }) =>
			expect(invoiceReference({ index, partition: '2025' }, 'annual')).toBe(expected));
	});
});

describe('Rate/percentage conversions', () => {
	test.for<[rate: number, percent: number]>([
		[0.155, 15.5],
		[0.07, 7], // 0.07 * 100 === 7.000000000000001 without rounding
		[0.0825, 8.25],
		[0, 0],
		[-2, -200],
	])('Converts stored rate %s to %s%', ([rate, percent]) =>
		expect(rateToPercent(rate)).toBe(percent));

	test.for<[rate: number, percent: number]>([
		[0.155, 15.5],
		[0.07, 7], // 0.07 * 100 === 7.000000000000001 without rounding
		[0.0825, 8.25],
		[0, 0],
		[-2, -200],
	])('Converts stored percent %s to %s%', ([rate, percent]) =>
		expect(percentToRate(percent)).toBe(rate));

	test.for([15.5, 7, 0.01, 12.34, 200])('Round-trips %s% through database serialisation', percent =>
		expect(rateToPercent(percentToRate(percent))).toBe(percent));
});

describe('pluralize', () => {
	test('Returns singular for count 1', () => expect(pluralize(1, 'item', 'items')).toBe('item'));

	test.for([0, 2, 100, -100])('Returns plural for count %i', count =>
		expect(pluralize(count, 'item', 'items')).toBe('items'));

	test.for([1.5, 0.5])('Returns plural for decimal %s', count =>
		expect(pluralize(count, 'hour', 'hours')).toBe('hours'));
});
