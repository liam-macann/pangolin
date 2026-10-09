import { describe, expect, test } from 'vitest';

import app from '@/api/hono';

import { asUser, bypassRLS, createTestSession } from '@/test/session';

describe('GET /api/invoices', () => {
	test('Returns 401 when there is no session', async () => {
		const res = await app.request('/api/invoices');
		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toMatchObject({ status: 401, code: 'unauthorized' });
	});

	asUser('Returns invoices with pagination metadata', async ({ seed }) => {
		await seed.invoices({ count: 2 });

		const res = await app.request('/api/invoices?limit=1&offset=0');
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.data).toHaveLength(1);
		expect(body.meta).toEqual({ total: 2, limit: 1, offset: 0 });
	});

	asUser('Filters by client, scoping both data and meta', async ({ seed }) => {
		const [client, other, uninvoiced] = await seed.clients({ count: 3, versions: 1 });
		const [first, second] = await seed.invoices({
			overrides: [
				{ clientDataId: client.versions[0].id, issuedAt: '2025-01-10' },
				{ clientDataId: client.versions[0].id, issuedAt: '2025-02-10' },
				{ clientDataId: other.versions[0].id },
			],
		});

		const res = await app.request(`/api/invoices?client=${client.id}`);
		const body = await res.json();

		// Listed newest first, by the issue dates pinned above
		expect(body.data.map((invoice: { id: string }) => invoice.id)).toEqual([second.id, first.id]);
		expect(body.meta).toEqual({ total: 2, limit: 200 });

		const excluded = await app.request(`/api/invoices?client=${uninvoiced.id}`);
		await expect(excluded.json()).resolves.toMatchObject({ data: [], meta: { total: 0 } });
	});

	asUser('No cross-tenant leakage when filtering with a client UUID', async ({ auth, seed }) => {
		const otherSession = await createTestSession(auth);
		const otherSeeder = seed({ userId: otherSession.user.id });

		// Their only client, so that their invoice must reference it
		const [otherClient] = await otherSeeder.clients({ count: 1 });
		await otherSeeder.invoices({ count: 1 });

		// Checks that withRLS is not the only protection
		const res = await bypassRLS(async () => app.request(`/api/invoices?client=${otherClient.id}`));
		const body = await res.json();

		expect(body.data).toHaveLength(0);
		expect(body.meta.total).toBe(0);
	});

	asUser('Returns 422 for a non-UUID client filter', async () => {
		const res = await app.request('/api/invoices?client=not-a-uuid');
		expect(res.status).toBe(422);
	});
});
