import { z } from 'zod';

import { collectNodes } from './introspection';

/** Zod types with a min/max value */
type ZodBounded =
	| z.core.$ZodString
	| z.core.$ZodStringFormat
	| z.core.$ZodNumber
	| z.core.$ZodNumberFormat
	| z.core.$ZodArray;

type Fallback = { readonly minimum?: unknown; readonly maximum?: unknown };

type Bounds<F extends Fallback = Record<never, never>> = {
	readonly minimum: number | ('minimum' extends keyof F ? F['minimum'] : never);
	readonly maximum: number | ('maximum' extends keyof F ? F['maximum'] : never);
};

const readBounds = (schema: z.core.$ZodType) => {
	const jsonSchema = z.toJSONSchema(schema, { unrepresentable: 'any' });

	return {
		minimum: jsonSchema.minimum ?? jsonSchema.minLength ?? jsonSchema.minItems,
		maximum: jsonSchema.maximum ?? jsonSchema.maxLength ?? jsonSchema.maxItems,
	};
};

/**
 * Combines numeric min/max checks from a scalar schema and their wrappers or pipes
 *
 * @param schema A scalar (non-object) Zod schema with bounds
 * @param predicate Selects nodes whose numeric bounds should be combined
 * @param fallbacks Values returned for missing bounds
 *
 * @returns The strictest `{ minimum, maximum }` pair
 *
 * @remarks
 * Pipes and transforms may change the logical intent of length bounds
 * The predicate argument allows specific nodes to be targeted, as the intended escape hatch
 *
 * @example
 * ```ts
 * const schema = z.string().min(20).pipe(z.coerce.number<string>().min(5).max(10));
 * getBounds(schema, node => node instanceof z.ZodNumber) // → { minimum: 5, maximum: 10 }
 * ```
 */
export function getBounds<
	Schema extends z.core.$ZodType,
	T extends ZodBounded = ZodBounded,
	const F extends Fallback = Record<never, never>,
>(
	// Type `never` provides quick feedback if misusing helper by providing an object schema
	schema: Schema extends z.ZodObject ? never : Schema,
	predicate?: (schema: z.core.$ZodType) => schema is T,
	fallbacks?: F,
): Bounds<F>;

export function getBounds(
	schema: z.core.$ZodType,
	predicate?: (schema: z.core.$ZodType) => schema is ZodBounded,
	fallbacks: Fallback = {},
): Bounds<Fallback> {
	// Collects all matching nodes, and then filters by nodes with explicit bounds
	const matches = collectNodes(
		schema,
		// Root-path filtering prevents a container from silently donating nested field bounds
		(node, path): node is ZodBounded => path === '' && (predicate?.(node) ?? true),
		{ pipe: 'both' },
	)
		.map(({ schema: node }) => readBounds(node))
		.filter(({ minimum, maximum }) => typeof minimum === 'number' || typeof maximum === 'number');

	const minimums = matches.flatMap(({ minimum }) => (typeof minimum === 'number' ? [minimum] : []));
	const maximums = matches.flatMap(({ maximum }) => (typeof maximum === 'number' ? [maximum] : []));

	return {
		minimum:
			minimums.length > 0
				? Math.max(...minimums) // Aggregated bound
				: 'minimum' in fallbacks
					? fallbacks.minimum // Specified fallback
					: -Infinity, // Default fallback
		maximum:
			maximums.length > 0
				? Math.min(...maximums) // Aggregated bound
				: 'maximum' in fallbacks
					? fallbacks.maximum // Specified fallback
					: Infinity, // Default fallback
	};
}
