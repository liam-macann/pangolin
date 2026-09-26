import { describe, expectTypeOf, test } from 'vitest';
import { z } from 'zod';

import { getBounds } from '@/lib/zod/bounds';

describe('getBounds()', () => {
	test('Infers the return type from fallbacks', () => {
		const defaults = getBounds(z.number().min(1));
		expectTypeOf(defaults.minimum).toEqualTypeOf<number>();
		expectTypeOf(defaults.maximum).toEqualTypeOf<number>();

		const fallbacks = getBounds(z.number().max(1), undefined, {
			minimum: 'unbounded',
			maximum: null,
		});
		expectTypeOf(fallbacks.minimum).toEqualTypeOf<number | 'unbounded'>();
		expectTypeOf(fallbacks.maximum).toEqualTypeOf<number | null>();

		const explicitUndefined = getBounds(z.number().max(1), undefined, { minimum: undefined });
		expectTypeOf(explicitUndefined.minimum).toEqualTypeOf<number | undefined>();
	});
});
