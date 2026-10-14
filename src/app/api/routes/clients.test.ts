import { randomUUID } from 'node:crypto';
import { assert, describe, expect, test } from 'vitest';

import app from '@/api/hono';

import { asUser, bypassRLS, createTestSession } from '@/test/session';

describe('GET /api/clients', () => {
	test('Returns 401 when there is no session', async () => {
		const res = await app.request('/api/clients');

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toMatchObject({ status: 401, code: 'unauthorized' });
	});

	asUser('Never returns clients belonging to another user', async ({ auth, seed }) => {
		const other = await createTestSession(auth);
		await seed({ userId: other.user.id }).clients({ count: 1, overrides: { isDeleted: false } });

		const [mine] = await seed.clients({ count: 1, overrides: { isDeleted: false } });

		// Checks that withRLS is not the only protection
		const res = await bypassRLS(async () => app.request('/api/clients'));
		const body = await res.json();

		expect(body.data, 'Should only include single client for user').toHaveLength(1);
		expect(body.data[0].id).toBe(mine.id);
		expect(body.meta).toEqual({ limit: 200, nextCursor: null });
	});
});

describe('GET /api/clients/{id}', () => {
	test('Returns 401 when there is no session', async () => {
		const res = await app.request(`/api/clients/${randomUUID()}`);
		expect(res.status).toBe(401);
	});

	asUser('Returns 422 for a non-UUID id', async () => {
		const res = await app.request('/api/clients/not-a-uuid');
		expect(res.status).toBe(422);
	});

	asUser('Returns 404 for a nonexistent client id', async () => {
		const res = await app.request(`/api/clients/${randomUUID()}`);
		expect(res.status).toBe(404);
	});

	asUser('Returns 404 for a client belonging to another user', async ({ auth, seed }) => {
		// Prevents leaking resource existence
		const { user } = await createTestSession(auth);
		const [{ id }] = await seed({ userId: user.id }).clients({ count: 1 });

		// Checks that withRLS is not the only protection
		const res = await bypassRLS(async () => app.request(`/api/clients/${id}`));
		expect(res.status).toBe(404);
	});

	asUser('Returns a single client', async ({ seed }) => {
		const [client] = await seed.clients({ count: 1 });

		const active = client.versions.find(version => version.validTo === null);
		assert(active, 'Seeded client should have an active version');

		const res = await app.request(`/api/clients/${client.id}`);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.data.id).toBe(client.id);
		expect(body.data.data).toMatchObject({ name: active.name, organization: active.organization });
	});
});
