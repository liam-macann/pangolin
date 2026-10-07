import { describe, expect, test } from 'vitest';

import app from '@/api/hono';
import {
	insertTestClient,
	insertTestInvoice,
	setUpConfigAndClient,
} from '@/lib/actions/tests/fixtures';

import { asUser, createTestSession, sessionStorage } from '@/test/session';

describe('GET /api/invoices', () => {
	test('Returns 401 when there is no session', async () => {
		const res = await app.request('/api/invoices');
		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toMatchObject({ status: 401, code: 'unauthorized' });
	});

	asUser('Returns invoices with pagination metadata', async () => {
		const { client } = await setUpConfigAndClient();
		await insertTestInvoice({ clientDataId: client.data.scdId });
		await insertTestInvoice({ clientDataId: client.data.scdId });

		const res = await app.request('/api/invoices?limit=1&offset=0');
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.data).toHaveLength(1);
		expect(body.meta).toEqual({ total: 2, limit: 1, offset: 0 });
	});

	asUser('Filters by client, scoping both data and meta', async () => {
		const { client: clientA } = await setUpConfigAndClient();
		const clientB = await insertTestClient();

		await insertTestInvoice({ clientDataId: clientA.data.scdId });
		await insertTestInvoice({ clientDataId: clientB.data.scdId });

		const res = await app.request(`/api/invoices?client=${clientA.id}`);
		const body = await res.json();

		expect(body.data).toHaveLength(1);
		expect(body.data[0].clientData.clientId).toBe(clientA.id);
		expect(body.meta).toEqual({ total: 1, limit: 200 });
	});

	asUser('No cross-tenant leakage when filtering with a client UUID', async ({ auth }) => {
		const otherSession = await createTestSession(auth);
		const otherClientId = await sessionStorage.run(otherSession, async () => {
			const { client } = await setUpConfigAndClient();
			await insertTestInvoice({ clientDataId: client.data.scdId });
			return client.id;
		});

		const res = await app.request(`/api/invoices?client=${otherClientId}`);
		const body = await res.json();

		expect(body.data).toHaveLength(0);
		expect(body.meta.total).toBe(0);
	});

	asUser('Returns 422 for a non-UUID client filter', async () => {
		const res = await app.request('/api/invoices?client=not-a-uuid');
		expect(res.status).toBe(422);
	});
});
