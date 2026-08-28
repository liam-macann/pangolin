import { createRulesetFunction } from '@stoplight/spectral-core/ruleset';

/**
 * @typedef {import('openapi-types').OpenAPIV3.OperationObject} OperationObject
 * @typedef {import('openapi-types').OpenAPIV3.ReferenceObject} ReferenceObject
 */

/**
 * Narrows an OpenAPI value to its inline (non-`$ref`) form
 * Spectral resolves every `$ref` before rules run, so this is just a type guard
 *
 * @template T
 * @param {T} value
 * @returns {value is Exclude<T, ReferenceObject | undefined>}
 */
const isInline = value => typeof value === 'object' && value !== null && !('$ref' in value);

/**
 * Flags a list operation whose success response allows fewer items than the
 * largest page its `limit` query parameter accepts.
 */
export default createRulesetFunction(
	{ input: null, options: null },
	/** @param {OperationObject} operation */
	operation => {
		const limit = (operation.parameters ?? []).find(
			parameter => isInline(parameter) && parameter.name === 'limit' && parameter.in === 'query',
		);
		if (!isInline(limit) || !isInline(limit.schema)) return;

		const maxPageSize = limit.schema.maximum;
		if (typeof maxPageSize !== 'number') return;

		const response = operation.responses['200'];
		if (!isInline(response)) return;

		const body = response.content?.['application/json']?.schema;
		if (!isInline(body) || !isInline(body.properties?.data)) return;

		const { maxItems } = body.properties.data;
		if (typeof maxItems !== 'number' || maxItems >= maxPageSize) return;

		return [
			{
				message: `response \`data\` caps at ${maxItems} items but \`limit\` permits up to ${maxPageSize}`,
			},
		];
	},
);
