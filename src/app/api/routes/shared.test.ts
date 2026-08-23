import { generateSpecs } from 'hono-openapi';
import { describe, expect, test } from 'vitest';

import { requireAuth } from '@/api/middleware';

import { createApiRouter, defineRoute } from './shared';

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
});
