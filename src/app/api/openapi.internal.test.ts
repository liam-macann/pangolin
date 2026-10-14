import { OpenAPIV3 } from 'openapi-types';
import { afterEach, assert, describe, expect, test, vi } from 'vitest';

import { getOpenApiDocument } from '@/api/hono';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('getOpenApiDocument()', () => {
	describe('Internal-only routes', () => {
		test('Documents internal routes outside production, for CI lint and fuzz coverage', async () => {
			vi.stubEnv('NODE_ENV', 'test');
			const document = await getOpenApiDocument();

			expect(document.paths).toHaveProperty('/avatar');
			expect(document.tags?.map(tag => tag.name)).toContain('Avatar');
		});

		test('Withholds internal routes and their orphaned tags from the production spec', async () => {
			vi.stubEnv('NODE_ENV', 'production');
			const document = await getOpenApiDocument();

			expect(document.paths).not.toHaveProperty('/avatar');
			expect(document.tags?.map(tag => tag.name)).not.toContain('Avatar');
		});
	});

	describe('Paginated routes', async () => {
		const document = await getOpenApiDocument();
		const methods = Object.values(OpenAPIV3.HttpMethods);

		// Breaks down each route path by method, so that each method returns a separate operation
		const operations = Object.entries(document.paths ?? {}).flatMap(([path, item]) =>
			methods.flatMap(method => {
				const operation = item?.[method];
				return operation ? [{ method, operation, path }] : [];
			}),
		);

		// Finds routes with a cursor query parameter
		const paginated = operations.flatMap(entry => {
			const queryParameters = (entry.operation.parameters ?? []).flatMap(param =>
				'$ref' in param || param.in !== 'query' ? [] : [param.name],
			);

			/** The title of the route, used for test descriptions. */
			const title = `${entry.method.toUpperCase()} ${entry.path}`;

			return queryParameters.includes('cursor')
				? ([[title, { ...entry, queryParameters }]] as const)
				: [];
		});

		describe.for(paginated)('%s', ([title, route]) => {
			const { operation, queryParameters } = route;

			test('Links cursor response to the next page via query parameters', async () => {
				const response = operation.responses?.[200];
				assert(response && !('$ref' in response), `Expected ${title} to define a 200 response`);

				const link = response.links?.NextPage;
				assert(link && !('$ref' in link), `Expected ${title} to define a NextPage link`);

				expect(link.operationId, 'Link operationId should match route').toBe(operation.operationId);
				expect(link.parameters).toMatchObject({
					cursor: '$response.body#/meta/nextCursor',
					...Object.fromEntries(
						queryParameters
							.filter(name => name !== 'cursor' && name !== 'limit')
							.map(name => [name, `$request.query.${name}`]),
					),
				});
			});
		});
	});
});
