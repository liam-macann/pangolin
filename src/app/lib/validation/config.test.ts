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
});
