import { generateSpecs } from 'hono-openapi';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { requireAuth } from '@/api/middleware';

import { createApiRouter, defineRoute, paginationQuerySchema, validator } from './shared';

describe('defineRoute', () => {
	const baseRoute = {
		responses: { 200: { description: 'Success' } },
	};

	test('Adds authentication middleware and security metadata to protected routes', () => {
		const route = defineRoute.protected(baseRoute);

		expect(route).toHaveLength(2);
		expect(route[1]).toBe(requireAuth);
	});

	test('Marks public routes as explicitly allowing anonymous access', () => {
		const route = defineRoute.public(baseRoute);

		expect(route).toHaveLength(1);
	});

	test('Passes route security metadata to the OpenAPI document', async () => {
		const app = createApiRouter()
			.get('/protected', ...defineRoute.protected(baseRoute), c => c.json({}, 200))
			.get('/public', ...defineRoute.public(baseRoute), c => c.json({}, 200));

		const document = await generateSpecs(app, {
			documentation: {
				info: { title: 'Test API', version: 'test' },
			},
		});

		const paths = document.paths ?? {};

		expect(paths['/protected']?.get?.security).toEqual([{ SessionCookie: [] }]);
		expect(paths['/public']?.get?.security).toEqual([{}]);
	});

	test('Adds a 401 response to protected routes but not public routes', async () => {
		const app = createApiRouter()
			.get('/protected', ...defineRoute.protected(baseRoute), c => c.json({}, 200))
			.get('/public', ...defineRoute.public(baseRoute), c => c.json({}, 200));

		const document = await generateSpecs(app, {
			documentation: { info: { title: 'Test API', version: 'test' } },
		});

		const paths = document.paths ?? {};

		expect(paths['/protected']?.get?.responses?.[401]).toBeDefined();
		expect(paths['/public']?.get?.responses?.[401]).toBeUndefined();
	});
});

describe('validator()', () => {
	test('Reads an array in a query as a comma-separated list', async () => {
		const params = z.object({ status: z.array(z.enum(['paid', 'unpaid'])) });
		const app = createApiRouter().get('/', validator('query', params), c =>
			c.json(c.req.valid('query'), 200),
		);

		const response = await app.request('/?status=paid,unpaid');

		await expect(response.json()).resolves.toEqual({ status: ['paid', 'unpaid'] });
	});

	test('Reports an invalid request body as a problem', async () => {
		const app = createApiRouter().post('/', validator('json', z.object({ name: z.string() })), c =>
			c.json(c.req.valid('json'), 200),
		);

		const response = await app.request('/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 1 }),
		});

		expect(response.status).toBe(422);
		expect(response.headers.get('Content-Type')).toMatch(/^application\/problem\+json/);
	});
});

describe('paginationQuerySchema', () => {
	test('Coerces a numeric limit, rejecting an empty one', () => {
		expect(paginationQuerySchema.parse({ limit: '1' })).toEqual({ limit: 1 });
		expect(paginationQuerySchema.validate({ limit: '' })).toBe(false);
	});

	test('Accepts a malformed cursor, so that it is reported as an invalid cursor', () => {
		// Rejecting it here would return a generic validation error instead of the domain problem
		expect(paginationQuerySchema.safeParse({ cursor: 'not base64url' }).success).toBe(true);
	});
});
