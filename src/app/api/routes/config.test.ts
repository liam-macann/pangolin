import { assert, describe, expect, test } from 'vitest';

import app from '@/api/hono';

import { asUser } from '@/test/session';

import { getResponse } from './config';

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

	asUser('Returns only documented fields', async ({ seed }) => {
		// An address and a tax are included, so that their fields are checked too
		const [tax] = await seed.taxes({ count: 1 });
		await seed.config({ versions: 1, overrides: [{ address: {}, taxes: [tax.id] }] });

		const body = await (await app.request('/api/config')).json();

		// Parsing strips undocumented keys at any depth, so a leaked field shows in the diff
		expect(body).toEqual(await getResponse.parseAsync(body));
	});
});
