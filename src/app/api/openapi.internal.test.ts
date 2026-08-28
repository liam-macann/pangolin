import { afterEach, describe, expect, test, vi } from 'vitest';

import { getOpenApiDocument } from '@/api/hono';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('getOpenApiDocument internal-route handling', () => {
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
