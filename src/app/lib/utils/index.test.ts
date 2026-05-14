import { describe, expect, test } from 'vitest';

import { invoiceReference, pluralize } from '@/lib/utils';

describe('invoiceReference', () => {
	const base = { index: 5, yearIndex: 3, issueYear: 2025 };

	describe('Sequential scheme', () => {
		test('Formats with INV- prefix', () =>
			expect(invoiceReference(base, 'sequential')).toBe('INV-005'));

		test.for([
			{ index: 1, expected: 'INV-001' },
			{ index: 42, expected: 'INV-042' },
		])('Pads $index → $expected', ({ index, expected }) =>
			expect(invoiceReference({ ...base, index }, 'sequential')).toBe(expected));

		test('Does not truncate indices beyond 3 digits', () =>
			expect(invoiceReference({ ...base, index: 4200 }, 'sequential')).toBe('INV-4200'));

		test('Does not allow negative indices', () =>
			expect(() => invoiceReference({ ...base, index: -1 }, 'sequential')).toThrow());
	});

	describe('Annual scheme', () => {
		test('Formats as year-index', () => expect(invoiceReference(base, 'annual')).toBe('2025-003'));

		test.for([
			{ yearIndex: 1, expected: '2025-001' },
			{ yearIndex: 42, expected: '2025-042' },
		])('Pads $yearIndex → $expected', ({ yearIndex, expected }) =>
			expect(invoiceReference({ ...base, yearIndex }, 'annual')).toBe(expected));

		test('Uses yearIndex, not global index', () => {
			const val = invoiceReference({ index: 100, yearIndex: 42, issueYear: 2024 }, 'annual');
			expect(val).toBe('2024-042');
		});

		test('Does not allow negative indices', () =>
			expect(() => invoiceReference({ ...base, yearIndex: -1 }, 'annual')).toThrow());
	});
});

describe('pluralize', () => {
	test('Returns singular for count 1', () => expect(pluralize(1, 'item', 'items')).toBe('item'));

	test.for([0, 2, 100, -100])('Returns plural for count %i', count =>
		expect(pluralize(count, 'item', 'items')).toBe('items'));

	test.for([1.5, 0.5])('Returns plural for decimal %s', count =>
		expect(pluralize(count, 'hour', 'hours')).toBe('hours'));
});
