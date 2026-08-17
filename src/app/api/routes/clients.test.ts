import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';

import app from '@/api/hono';
import { insertTestClient } from '@/lib/actions/tests/helpers';

import { asUser, createTestSession, sessionStorage } from '@/test/session';

describe('GET /api/clients', () => {
	test('Returns 401 when there is no session', async () => {
		const res = await app.request('/api/clients');

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toMatchObject({ status: 401, code: 'unauthorized' });
	});

	asUser('Returns clients with pagination metadata', async () => {
		await insertTestClient({ name: 'Hamish Heckathorn' });
		await insertTestClient({ name: 'Marshun Defina' });

		const res = await app.request('/api/clients?limit=1&offset=0');
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.data).toHaveLength(1);
		expect(body.meta).toEqual({ total: 2, limit: 1, offset: 0 });
	});

	asUser('Never returns clients belonging to another user', async ({ db, auth }) => {
		const otherSession = await createTestSession(db, auth);
		await sessionStorage.run(otherSession, () => insertTestClient({ name: 'Other User' }));

		await insertTestClient({ name: 'My Client' });

		const res = await app.request('/api/clients');
		const body = await res.json();

		expect(body.data).toHaveLength(1);
		expect(body.data[0].data.name).toBe('My Client');
		expect(body.meta.total).toBe(1);
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

	asUser('Returns 404 for a client belonging to another user', async ({ db, auth }) => {
		// Prevents leaking resource existence
		const otherSession = await createTestSession(db, auth);
		const { id } = await sessionStorage.run(otherSession, () => insertTestClient());

		const res = await app.request(`/api/clients/${id}`);
		expect(res.status).toBe(404);
	});

	asUser('Returns a single client', async () => {
		const { id } = await insertTestClient({ name: 'Ada Lovelace' });

		const res = await app.request(`/api/clients/${id}`);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.data.id).toBe(id);
		expect(body.data.data.name).toBe('Ada Lovelace');
	});
});
