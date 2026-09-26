import { describe, expectTypeOf, test } from 'vitest';

import { isNumericString, type NumericString } from '@/lib/utils/numeric';

describe('isNumericString', () => {
	test('Narrows to NumericString', () => {
		expectTypeOf(isNumericString).guards.toEqualTypeOf<NumericString>();
	});
});
