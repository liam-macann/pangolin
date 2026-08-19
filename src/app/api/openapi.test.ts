import { generateSpecs, resolver, validator } from 'hono-openapi';
import { assert, describe, expect, test } from 'vitest';
import { z } from 'zod';

import '@/api/openapi';
import { createApiRouter, defineRoute, validationHook } from '@/api/routes/shared';

/** Generates an OpenAPI document and returns a query-parameter schema lookup */
const getQuerySchemas = async (query: z.ZodType) => {
	const app = createApiRouter().get(
		'/resource',
		...defineRoute.public({ responses: { 200: { description: 'Success' } } }),
		validator('query', query, validationHook),
		c => c.json({}, 200),
	);

	const document = await generateSpecs(app, {
		documentation: { info: { title: 'Test API', version: 'test' } },
	});

	return (name: string) => {
		const parameter = document.paths?.['/resource']?.get?.parameters?.find(
			value => 'name' in value && value.name === name,
		);

		assert(
			parameter && 'schema' in parameter,
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
		['date', z.iso.date()],
		['date-time', z.iso.datetime()],
	] as const)('Documents %s formats without intrinsic patterns', async ([format, schema]) => {
		const schemaFor = await getQuerySchemas(z.object({ [format]: schema }));

		expect(schemaFor(format)).toMatchObject({ format: format });
		expect(schemaFor(format)).not.toHaveProperty('pattern');
	});

	test.for([
		['uuid', z.uuid()],
		['date', z.iso.date()],
		['date-time', z.iso.datetime()],
	] as const)('Preserves explicit %s regex patterns', async ([format, schema]) => {
		const schemaFor = await getQuerySchemas(
			z.object({ [format]: schema.regex(new RegExp(`^custom-${format}$`)) }),
		);

		expect(schemaFor(format)).toMatchObject({
			allOf: [{ pattern: `^custom-${format}$`, type: 'string' }],
			format: format,
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
		expect(schemaFor('both')).toMatchObject({
			format: 'int32',
			minimum: 0,
			maximum: 100,
		});
	});
});
