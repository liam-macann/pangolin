import { generateSpecs, resolver, validator } from 'hono-openapi';
import { assert, describe, expect, test } from 'vitest';
import { z } from 'zod';
import { type JSONSchemaGeneratorParams } from 'zod/v4/core';

import '@/api/openapi';
import { createApiRouter, defineRoute, validationHook } from '@/api/routes/shared';

/** Generates an OpenAPI document and returns a query-parameter schema lookup */
const getQuerySchemas = async (query: z.ZodType, options?: Parameters<typeof resolver>[1]) => {
	const app = createApiRouter().get(
		'/resource',
		...defineRoute.public({ responses: { 200: { description: 'Success' } } }),
		validator('query', query, validationHook, options),
		c => c.json({}, 200),
	);

	const document = await generateSpecs(app);

	return (name: string) => {
		const parameter = document.paths?.['/resource']?.get?.parameters?.find(
			value => 'name' in value && value.name === name,
		);

		assert(
			parameter && 'schema' in parameter && parameter.schema,
			`Expected the ${name} query parameter to have a schema.`,
		);

		return parameter.schema;
	};
};

describe("OpenAPI loadVendor('zod')", () => {
	test('Respects the requested IO type for piped schemas', async () => {
		const schema = z.coerce.number().int().positive().max(100).pipe(z.int32());
		const input = await resolver(schema, { options: { io: 'input' } }).toOpenAPISchema();
		const output = await resolver(schema, { options: { io: 'output' } }).toOpenAPISchema();

		expect(input.schema).not.toHaveProperty('format');
		expect(output.schema).toMatchObject({ format: 'int32' });
	});

	test.for([
		['uuid', z.uuid()],
		['email', z.email()],
		['date', z.iso.date()],
		['date-time', z.iso.datetime()],
		['base64', z.base64()],
		['base64url', z.base64url()],
	] as const)('Documents %s without intrinsic patterns', async ([format, schema]) => {
		const spec = (await getQuerySchemas(z.object({ property: schema })))('property');

		const hasFormat = 'format' in spec && spec.format === format;
		const hasEncoding = 'contentEncoding' in spec && spec.contentEncoding === format;

		// Logical XOR: exactly one should be present
		expect(hasFormat !== hasEncoding, 'Expected either format or encoding to match').toBe(true);
		expect(spec).not.toHaveProperty('pattern');
	});

	test.for([
		['uuid', z.uuid()],
		['email', z.email()],
		['date', z.iso.date()],
		['date-time', z.iso.datetime()],
		['base64', z.base64()],
		['base64url', z.base64url()],
	] as const)('Preserves explicit %s pattern constraints', async ([format, schema]) => {
		const spec = await getQuerySchemas(
			z.object({
				property: schema
					.startsWith('prefix-')
					.regex(new RegExp(`^custom-${format}$`))
					.regex(/\w/)
					.endsWith('-suffix')
					.includes('middle'),
			}),
		).then(lookup => lookup('property'));

		const hasFormat = 'format' in spec && spec.format === format;
		const hasEncoding = 'contentEncoding' in spec && spec.contentEncoding === format;

		// Logical XOR: exactly one should be present
		expect(hasFormat !== hasEncoding, 'Expected either format or encoding to match').toBe(true);

		expect('allOf' in spec && spec.allOf).toHaveLength(5);
		expect(spec).toMatchObject({
			allOf: expect.arrayContaining([
				{ pattern: '^prefix-.*', type: 'string' },
				{ pattern: `^custom-${format}$`, type: 'string' },
				{ pattern: '\\w', type: 'string' },
				{ pattern: '.*-suffix$', type: 'string' },
				{ pattern: 'middle', type: 'string' },
			]),
		});
	});

	test.for([
		['uuid', z.uuid()],
		['email', z.email()],
		['date', z.iso.date()],
		['date-time', z.iso.datetime()],
		['base64', z.base64()],
		['base64url', z.base64url()],
	] as const)('Preserves unrelated %s allOf constraints', async ([format, schema]) => {
		const target = schema.regex(new RegExp(`^custom-${format}$`));

		const override: JSONSchemaGeneratorParams['override'] = context => {
			if (context.zodSchema !== target) return;

			// Inject allOf members and verify they are not overridden
			context.jsonSchema.allOf = [
				...(context.jsonSchema.allOf ?? []),
				{ maxLength: 64, minLength: 12, type: 'string' },
				{ enum: ['allowed-value'] },
				{ not: { pattern: '^forbidden-' } },
				{ anyOf: [{ pattern: '^customer-' }, { pattern: '^supplier-' }] },
			];
		};

		const spec = await getQuerySchemas(z.object({ target }), {
			options: { override },
		}).then(lookup => lookup('target'));

		expect('allOf' in spec && spec.allOf).toHaveLength(5);
		expect(spec).toMatchObject({
			allOf: expect.arrayContaining([
				{ maxLength: 64, minLength: 12, type: 'string' },
				{ enum: ['allowed-value'] },
				{ not: { pattern: '^forbidden-' } },
				{ anyOf: [{ pattern: '^customer-' }, { pattern: '^supplier-' }] },
				{ pattern: `^custom-${format}$`, type: 'string' },
			]),
		});
	});

	test('Documents int32 format without implicit bounds', async () => {
		const schemaFor = await getQuerySchemas(
			z.object({
				plain: z.int32(),
				min: z.int32().min(0),
				max: z.int32().max(100),
				both: z.int32().min(0).max(100),
			}),
		);

		expect(schemaFor('plain')).toMatchObject({ format: 'int32' });
		expect(schemaFor('plain')).not.toHaveProperty('minimum');
		expect(schemaFor('plain')).not.toHaveProperty('maximum');
		expect(schemaFor('min')).toMatchObject({ format: 'int32', minimum: 0 });
		expect(schemaFor('max')).toMatchObject({ format: 'int32', maximum: 100 });
		expect(schemaFor('both')).toMatchObject({ format: 'int32', minimum: 0, maximum: 100 });
	});
});
