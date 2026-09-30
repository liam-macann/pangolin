import { describe, expect, test } from 'vitest';

import { taxes } from '@/lib/validation/config';

describe('taxes', () => {
	// Rates are validated as user-facing percentages; conversion to stored
	// fraction happens in updateUserConfig(), after parsing
	test.for([15.5, 0.01, 7, 10, 200])('Accepts fractional percent rate %s', rate =>
		expect(taxes.safeParse([{ name: 'GST', rate }]).success).toBe(true),
	);

	test.for([0.155, 200.01, -1])('Rejects out-of-contract rate %s', rate =>
		expect(taxes.safeParse([{ name: 'GST', rate }]).success).toBe(false),
	);

	test('Serializes validated percentages as decimal strings', () => {
		expect(taxes.parse([{ name: 'GST', rate: 15.5 }])).toEqual([{ name: 'GST', rate: '15.50' }]);
	});

	test('Allows distinct labels and rates with the same concatenated key', () => {
		expect(
			taxes.safeParse([
				{ name: 'AB1', rate: 2 },
				{ name: 'AB', rate: 12 },
			]).success,
		).toBe(true);
	});
});
