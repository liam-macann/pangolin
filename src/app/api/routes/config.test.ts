import { describe, expect, test } from 'vitest';

import app from '@/api/hono';
import { insertTestConfig } from '@/lib/actions/tests/helpers';

import { asUser } from '@/test/session';

describe('GET /api/config', () => {
	test('Returns 401 when there is no session', async () => {
		const res = await app.request('/api/config');
		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toMatchObject({ status: 401, code: 'unauthorized' });
	});

	asUser('Returns the currently active config', async () => {
		await insertTestConfig({ tradingName: 'Acme Pty Ltd' });
		// Supersede it with a second version
		await insertTestConfig({ tradingName: 'Acme Holdings' });

		const res = await app.request('/api/config');
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.data.tradingName).toBe('Acme Holdings');
	});
});
