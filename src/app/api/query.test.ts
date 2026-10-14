import { Hono } from 'hono';
import { hc } from 'hono/client';
// biome-ignore lint/style/noRestrictedImports: Tests queryParams() apart from the shared validator
import { validator } from 'hono-openapi';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';

import { buildSearchParams, queryParams } from './query';

describe('queryParams()', () => {
	const Status = z.enum(['paid', 'unpaid', 'refunded']);

	const schema = z
		.object({
			required: z.array(Status),
			status: z.array(Status).optional(),
			tags: z.array(z.string()).default(['default']),
			sort: z
				.array(z.enum(['name:asc', 'name:desc']))
				.transform(terms => terms.map(term => term.split(':')))
				.prefault(['name:asc']),

			// Not an array param, and should fall through
			search: z.string().optional(),
		})
		.strict();

	/** Build an index route, with queryParams() provided as a validator hook, that simply returns query parameters. */
	const app = new Hono().get('/', validator('query', queryParams(schema)), c =>
		c.json(c.req.valid('query')),
	);

	/** A test Hono client. */
	const client = hc<typeof app>('http://localhost', {
		fetch: (input: RequestInfo | URL, init?: RequestInit) => app.request(input, init),
		buildSearchParams,
	});

	test('Splits array parameters, leaving a comma in any other parameter intact', async () => {
		const response = await app.request(
			'/?required=paid&status=paid,unpaid&sort=name:desc&tags=a,b&search=a,b',
		);

		await expect(response.json()).resolves.toEqual({
			required: ['paid'],
			status: ['paid', 'unpaid'],
			sort: [['name', 'desc']], // Should have gone through Zod transform
			tags: ['a', 'b'],
			search: 'a,b', // Not an array, should fall through
		});
	});

	test('Reads an empty value as an empty list, and an omitted one as its default', async () => {
		const response = await app.request('/?required=&sort=&search=');

		await expect(response.json()).resolves.toEqual({
			required: [],
			sort: [],
			tags: ['default'],
			search: '',
		});

		const omitted = await app.request('/?required=paid');
		await expect(omitted.json()).resolves.toMatchObject({ sort: [['name', 'asc']] });
	});

	test('Consolidates a repeated key into one list', async () => {
		const response = await app.request('/?required=paid,unpaid&required=refunded');

		await expect(response.json()).resolves.toMatchObject({
			required: ['paid', 'unpaid', 'refunded'],
		});
	});

	test.for([
		['a trailing separator', 'required=paid,'],
		['a space as the separator', 'required=paid unpaid'],
		['an omitted required array', 'status=paid'],
		['an unknown parameter', 'required=paid&other=1'],
	])('Rejects %s', async ([, query]) => {
		const response = await app.request(`/?${query}`);
		expect(response.status).toBe(400);
	});

	test('Refuses a parameter that is an array only as part of a union', () => {
		// queryParams does not resolve anyOf unions, as it is not safe to split non-array values
		expect(() => queryParams(z.object({ status: z.array(Status).nullable() }))).toThrow(
			'cannot be a union containing an array',
		);

		expect(() => queryParams(z.object({ search: z.string().nullable() }))).not.toThrow(); // Positive control
	});

	test('Follows a parameter schema registered with an ID', async () => {
		const Statuses = z.array(Status).meta({ id: 'QueryParamsStatuses' });

		await expect(
			queryParams(z.object({ status: Statuses })).parseAsync({ status: 'paid,unpaid' }),
		).resolves.toEqual({ status: ['paid', 'unpaid'] });

		expect(() => queryParams(z.object({ status: Statuses.nullable() }))).toThrow(
			'cannot be a union containing an array',
		);
	});

	test('Types and round-trips arrays through the RPC client', async () => {
		type Item = z.infer<typeof Status>;
		type Query = Parameters<typeof client.index.$get>[0]['query'];

		expectTypeOf<Query>().toExtend<{ required: Item[]; status?: Item[]; search?: string }>();
		expectTypeOf<{ required: ['unknown'] }>().not.toExtend<Query>();

		const response = await client.index.$get({ query: { required: ['paid'], sort: [] } });
		await expect(response.json()).resolves.toMatchObject({ required: ['paid'], sort: [] });
	});
});

describe('buildSearchParams()', () => {
	test('Joins an array into a single value, keeping empty params', () => {
		const params = buildSearchParams({ status: ['paid', 'unpaid'], limit: '20', empty: [] });

		expect(params.toString()).toBe('status=paid%2Cunpaid&limit=20&empty=');
	});
});
