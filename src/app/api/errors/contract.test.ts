import { generateSpecs } from 'hono-openapi';
import { describe, expect, test } from 'vitest';

import { createApiRouter, defineRoute } from '@/api/routes/shared';

import { problemContract } from './contract';

describe('problemContract()', () => {
	test('Documents multiple problem examples that share an HTTP status', async () => {
		const description422 = 'Query parameters (including pagination cursor) are invalid.';

		const app = createApiRouter().get(
			'/resource',
			...defineRoute.public({
				responses: {
					200: { description: 'Success' },
					...problemContract({
						422: { description: description422, problems: ['INVALID_CURSOR', 422] },
					}),
				},
			}),
			c => c.json({}, 200),
		);

		const spec = await generateSpecs(app, {
			documentation: { info: { title: 'Test API', version: 'test' } },
		});

		expect(spec.paths?.['/resource']?.get?.responses?.[422]).toMatchObject({
			description: description422,
			content: {
				'application/problem+json': {
					schema: { title: 'ProblemDetails' },
					examples: {
						'invalid-cursor': {
							summary: 'Invalid Pagination Cursor',
							value: { code: 'invalid-cursor', status: 422, title: 'Invalid Pagination Cursor' },
						},
						'http-422': { value: { status: 422 } },
					},
				},
			},
		});
	});

	test('Rejects registry problems whose status conflicts with the response status', () => {
		expect(() =>
			// @ts-expect-error Deliberately exercises the runtime guard
			problemContract({ 422: { description: 'Invalid request.', problems: ['NOT_FOUND'] } }),
		).toThrow('NOT_FOUND has status 404, but was declared under a 422 response');
	});

	test('Rejects duplicate problem references', () => {
		expect(() =>
			problemContract({
				// @ts-expect-error Deliberately exercises the runtime guard
				422: { description: 'Invalid request.', problems: ['INVALID_CURSOR', 'INVALID_CURSOR'] },
			}),
		).toThrow('Problem references must be unique within the 422 response');

		expect(() =>
			problemContract({
				// @ts-expect-error Deliberately exercises the runtime guard
				204: { description: 'Invalid request.', problems: [204, 204] },
			}),
		).toThrow('Problem references must be unique within the 204 response');
	});
});
