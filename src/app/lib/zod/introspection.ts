import { z } from 'zod';

/** A Zod schema matched at a dot-separated logical field path */
export type ZodNode<T extends z.core.$ZodType = z.core.$ZodType> = {
	readonly schema: T;
	readonly path: string;
};

/** Returns the inner schema for wrappers that preserve a logical field and path
 *  @remarks i.e. unwraps .catch() but not .transform() */
const unwrap = (schema: z.core.$ZodType): z.core.$ZodType | undefined => {
	if (
		schema instanceof z.ZodCatch ||
		schema instanceof z.ZodDefault ||
		schema instanceof z.ZodNonOptional ||
		schema instanceof z.ZodNullable ||
		schema instanceof z.ZodOptional ||
		schema instanceof z.ZodPrefault ||
		schema instanceof z.ZodReadonly ||
		schema instanceof z.ZodLazy
	) {
		return schema.unwrap();
	}

	return undefined;
};

interface FindZodOptions {
	pipe?: 'input' | 'output' | 'both';
}

/**
 * Recursively finds Zod nodes that match a predicate, retaining a path to the field
 *
 * @param schema A native Zod schema node
 * @param predicate Provides node schema and path, returning a boolean marking the node for inclusion
 * @param options Controls whether z.pipe() exposes input, output, or both validation stages
 *
 * @returns `{ schema: T; path: string; }[]`
 *
 *
 * @example
 * ```ts
 * // A single path may contain many nodes
 * z.string().max(100).optional()
 * ```
 * ```text
 * ZodOptional
 * └── ZodString(max: 100)
 * ```
 *
 * @example
 * ```ts
 * // Input and output schemas may diverge, even on a single path
 * z.string().min(2).pipe(z.number().max(10))
 * ```
 * ```text
 * ZodPipe
 * ├── input:  ZodString(min: 2)
 * └── output: ZodNumber(max: 10)
 * ```
 */
export function collectNodes<T extends z.core.$ZodType>(
	schema: z.core.$ZodType,
	predicate: (schema: z.core.$ZodType, path: string) => schema is T,
	options?: FindZodOptions,
): ZodNode<T>[];

export function collectNodes(
	schema: z.core.$ZodType,
	predicate: (schema: z.core.$ZodType, path: string) => boolean,
	{ pipe = 'output' }: FindZodOptions = {},
): ZodNode[] {
	/** Visits a branch with its own ancestor set, allowing shared schemas at different paths */
	const visit = (
		current: z.core.$ZodType,
		path: string,
		ancestors: ReadonlySet<z.core.$ZodType | (() => z.core.$ZodType)>,
	): ZodNode[] => {
		const identity = current instanceof z.ZodLazy ? current._zod.def.getter : current;
		if (ancestors.has(identity)) return [];

		const nextAncestors = new Set(ancestors);
		nextAncestors.add(identity);

		// If the predicate returns true for this node, spread this current node into return array
		const matches = predicate(current, path) ? [{ schema: current, path }] : [];

		if (current instanceof z.ZodPipe) {
			// Pipes have an input and an output schema. Respect configuration arg when determining what to collect.
			const input = pipe === 'output' ? [] : visit(current.in, path, nextAncestors);
			const output = pipe === 'input' ? [] : visit(current.out, path, nextAncestors);
			return [...matches, ...input, ...output];
		}

		// Both wrapped node and unwrapped node (which is also traversed) are included in collected array
		const child = unwrap(current);
		if (child) return [...matches, ...visit(child, path, nextAncestors)];

		if (current instanceof z.ZodObject) {
			return [
				...matches,
				...Object.entries(current.shape).flatMap(([key, field]) =>
					visit(field, path ? `${path}.${key}` : key, nextAncestors),
				),
			];
		}

		if (current instanceof z.ZodArray) {
			return [
				...matches,
				...visit(current.element, path ? `${path}.items` : 'items', nextAncestors),
			];
		}

		if (current instanceof z.ZodTuple) {
			const items = current._zod.def.items.map((item, index) =>
				visit(item, path ? `${path}.[${index}]` : `[${index}]`, nextAncestors),
			);

			const rest = current._zod.def.rest
				? [visit(current._zod.def.rest, path ? `${path}.items` : 'items', nextAncestors)]
				: [];

			return [...matches, ...items.flat(), ...rest.flat()];
		}

		const iterateOver = (children: ReadonlyArray<readonly [z.core.$ZodType, string]>) => [
			...matches,
			...children.flatMap(([child, key]) =>
				visit(child, path ? `${path}.${key}` : key, nextAncestors),
			),
		];

		if (current instanceof z.ZodUnion) {
			return iterateOver(current.options.map((option, index) => [option, `[${index}]`]));
		}

		if (current instanceof z.ZodIntersection) {
			return iterateOver([
				[current._zod.def.left, 'left'],
				[current._zod.def.right, 'right'],
			]);
		}

		if (current instanceof z.ZodRecord || current instanceof z.ZodMap) {
			return iterateOver([
				[current.keyType, 'key'],
				[current.valueType, 'value'],
			]);
		}

		if (current instanceof z.ZodSet) {
			return iterateOver([[current._zod.def.valueType, 'items']]);
		}

		return matches;
	};

	return visit(schema, '', new Set());
}
