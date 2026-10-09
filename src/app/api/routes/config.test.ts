import { assert, describe, expect, test } from 'vitest';

import app from '@/api/hono';

import { asUser } from '@/test/session';

describe('GET /api/config', () => {
	test('Returns 401 when there is no session', async () => {
		const res = await app.request('/api/config');
		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toMatchObject({ status: 401, code: 'unauthorized' });
	});

	asUser('Returns the currently active config', async ({ seed }) => {
		const active = (await seed.config({ versions: 4 })).at(-1);
		assert(active?.validTo === null, 'The last seeded config should be valid');

		const res = await app.request('/api/config');
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.data).toMatchObject({ id: active.id });
	});
});
