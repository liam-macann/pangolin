import { type ClientRequestOptions } from 'hono/client';
import { z } from 'zod';

const split = <T>(value: T) => {
	if (typeof value !== 'string') return value;
	// An empty value is an empty list, not an array with one empty item
	return value === '' ? [] : value.split(',');
};

/** Names of the parameters a query schema declares as an array.
 * @remarks Read from the JSON Schema of its input, so always aligns with generated OpenAPI specification. */
const findArrays = (schema: z.ZodObject) => {
	const { properties = {}, $defs = {} } = z.toJSONSchema(schema, {
		io: 'input',
		unrepresentable: 'any',
	});

	/** Follows a reference to the definition it names, for a schema registered with an ID. */
	const resolve = (prop: z.core.JSONSchema._JSONSchema | undefined) =>
		typeof prop === 'object' && prop.$ref ? $defs[prop.$ref.replace('#/$defs/', '')] : prop;

	const isArray = (prop: z.core.JSONSchema._JSONSchema | undefined) => {
		const resolved = resolve(prop);
		return typeof resolved === 'object' && resolved.type === 'array';
	};

	return Object.entries(properties).flatMap(([name, prop]) => {
		if (isArray(prop)) return [name];

		// Does not resolve unions, as it is not safe to split non-array values.
		// Throws to prevent array silently falling back to the exploded array form.
		const resolved = resolve(prop);
		if (typeof resolved === 'object' && [resolved.anyOf, resolved.allOf].flat().some(isArray))
			throw new Error(`Query parameter "${name}" cannot be a union containing an array`);

		return [];
	});
};

/** A query schema whose every array is carried as a single comma-separated string.
 *
 * @example ?status=paid,unpaid

 * @remarks
 * - Items must never contain a comma: the query is decoded before it is split, so an escaped one can't be told apart
 * - A repeated key is tolerated, with each of its values read as a list
 *
 * @privateRemarks Must be documented in OpenAPI as an array with `style: form, explode: false`. */
export const queryParams = <TSchema extends z.ZodObject>(schema: TSchema) => {
	const lists = findArrays(schema);

	return z.preprocess((query: z.input<TSchema>) => {
		const entries: [string, unknown][] = Object.entries(query);

		return Object.fromEntries(
			entries.map(([name, value]) =>
				lists.includes(name)
					? [name, Array.isArray(value) ? value.flatMap(split) : split(value)]
					: [name, value],
			),
		);
	}, schema);
};

/** Serializes the query of an RPC request, joining arrays into a single string value. */
export const buildSearchParams: NonNullable<ClientRequestOptions['buildSearchParams']> = query => {
	const params = new URLSearchParams();

	Object.entries(query).forEach(([key, value]) => {
		if (value === undefined) return;
		params.set(key, Array.isArray(value) ? value.join(',') : value);
	});

	return params;
};
