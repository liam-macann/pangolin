import { describe, expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';

import { getBounds } from '@/lib/zod/bounds';

const isNumber = (schema: z.core.$ZodType): schema is z.core.$ZodNumber =>
	schema instanceof z.ZodNumber || schema instanceof z.ZodNumberFormat;

describe('getBounds()', () => {
	test.for([z.number(), z.string(), z.array(z.any()), z.int(), z.email()])(
		'Reads min/max off a bounded $constructor.name schema',
		schema => expect(getBounds(schema.min(2).max(5))).toEqual({ minimum: 2, maximum: 5 }),
	);

	test('Defaults missing bounds to ±Infinity', () => {
		expect(getBounds(z.number().min(2))).toEqual({ minimum: 2, maximum: Infinity });
		expect(getBounds(z.number().max(2))).toEqual({ minimum: -Infinity, maximum: 2 });
	});

	test('Allows missing bounds fallback to be overridden', () => {
		// The fallback here does nothing
		expect(getBounds(z.string().min(2), undefined, { minimum: 0 })).toEqual({
			minimum: 2,
			maximum: Infinity,
		});

		expect(getBounds(z.array(z.number()).max(2), undefined, { minimum: 'sentinel' })).toEqual({
			minimum: 'sentinel',
			maximum: 2,
		});

		expect(getBounds(z.string().min(-2), undefined, { minimum: 0, maximum: null })).toEqual({
			minimum: -2,
			maximum: null,
		});

		expect(getBounds(z.number().max(-2), undefined, { minimum: undefined, maximum: null })).toEqual(
			{ minimum: undefined, maximum: -2 },
		);
	});

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
		expect(explicitUndefined.minimum).toBeUndefined();
	});

	test('Combines constraints across both sides of a pipe', () => {
		// Without fallbacks
		const schema = z.number().min(2).pipe(z.number().min(1).max(5));
		expect(getBounds(schema, isNumber)).toEqual({ minimum: 2, maximum: 5 });

		// With fallbacks
		const splitBounds = z.number().pipe(z.number().max(5));
		expect(getBounds(splitBounds, isNumber, { minimum: 0, maximum: 0 })).toEqual({
			minimum: 0,
			maximum: 5,
		});
	});

	test('Does not donate nested bounds to the root schema', () => {
		const schema = z.array(z.string().min(5).max(10)).min(2);
		expect(getBounds(schema)).toEqual({ minimum: 2, maximum: Infinity });
	});

	test('Respects the schema predicate', () => {
		// Pipes and transforms may change the logical intent of length bounds
		// The predicate argument allows specific nodes to be targeted, as the intended escape hatch
		const schema = z.string().min(20).pipe(z.coerce.number<string>().min(5).max(10));

		expect(getBounds(schema)).toEqual({ minimum: 20, maximum: 10 });
		expect(getBounds(schema, isNumber)).toEqual({ minimum: 5, maximum: 10 });
	});
});
