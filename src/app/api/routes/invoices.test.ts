import { assert, describe, expect, test } from 'vitest';

import { Client } from '@/api/dto/client';
import app from '@/api/hono';

import { asUser, bypassRLS, createTestSession } from '@/test/session';

import { keyset } from './invoices';

describe('GET /api/invoices', () => {
	test('Returns 401 when there is no session', async () => {
		const res = await app.request('/api/invoices');
		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toMatchObject({ status: 401, code: 'unauthorized' });
	});

	asUser('Builds a cursor from every field, without exceeding length', async ({ seed }) => {
		// Intended as a maximum cursor length check,
		// but it is not practical to figure out exact maximum representation for every field.

		const nameLen = Client.shape.data.shape.name.unwrap().maxLength;
		const orgLen = Client.shape.data.shape.organization.unwrap().maxLength;
		assert(nameLen, 'Names must have a maximum length');
		assert(orgLen, 'Organizations must have a maximum length');

		const [client] = await seed.clients({
			versions: 1,
			// Character takes three bytes, one code point
			overrides: { data: { name: '界'.repeat(nameLen), organization: '界'.repeat(orgLen) } },
		});

		await seed.invoices({
			count: 2,
			overrides: {
				clientDataId: client.versions[0].id,
				items: [{ quantity: '10000.00', unitCost: '1000000.0000', taxes: [] }],
			},
		});

		// Include every sortable field
		const sortFields = keyset.sortParam.def.in.element.options.filter(key => key.startsWith('-'));
		const res = await app.request(`/api/invoices?limit=1&sort=${sortFields.join(',')}`);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.meta.nextCursor).toEqual(expect.any(String));
	});

	// Each field orders the three invoices below differently, so that none can stand in for another
	asUser.for([
		['issuedAt', [0, 1, 2]],
		['name', [2, 0, 1]],
		['organization', [1, 0, 2]],
		['amount', [2, 1, 0]],
	] as const)('Sorts invoices by %s', async ([field, order], { seed }) => {
		const [alex, blake, casey] = await seed.clients({
			versions: 1,
			overrides: [
				{ data: { name: 'Alex Example', organization: 'Zenith Example Ltd' } },
				{ data: { name: 'Blake Example', organization: 'Delta Example Ltd' } },
				{ data: { name: 'Casey Example', organization: null } },
			],
		});

		const invoices = await seed.invoices({
			overrides: [
				{
					issuedAt: '2025-01-10',
					clientDataId: blake.versions[0].id,
					items: [{ quantity: '1', unitCost: '30', taxes: [] }],
				},
				{
					issuedAt: '2025-02-10',
					clientDataId: casey.versions[0].id,
					items: [{ quantity: '1', unitCost: '20', taxes: [] }],
				},
				{
					issuedAt: '2025-03-10',
					clientDataId: alex.versions[0].id,
					items: [{ quantity: '1', unitCost: '10', taxes: [] }],
				},
			],
		});

		const list = async (direction: '' | '-') => {
			const res = await app.request(`/api/invoices?sort=${direction}${field}`);
			const body = await res.json();
			return body.data.map((invoice: { id: string }) => invoice.id);
		};

		const ascending = order.map(index => invoices[index].id);

		expect(await list('')).toEqual(ascending);
		expect(await list('-')).toEqual(ascending.toReversed());
	});

	asUser('Orders invoices issued on the same date by creation', async ({ seed }) => {
		const [earlier, later] = await seed.invoices({
			overrides: [
				{ issuedAt: '2026-01-01', createdAt: '2026-01-01T09:00:00Z' },
				{ issuedAt: '2026-01-01', createdAt: '2026-01-01T17:00:00Z' },
			],
		});

		const list = async (sort: string) => {
			const res = await app.request(`/api/invoices?sort=${sort}`);
			const body = await res.json();
			return body.data.map((invoice: { id: string }) => invoice.id);
		};

		expect(await list('issuedAt')).toEqual([earlier.id, later.id]);
		expect(await list('-issuedAt')).toEqual([later.id, earlier.id]);
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
		expect(body.meta).toEqual({ limit: 200, nextCursor: null });

		const excluded = await app.request(`/api/invoices?client=${uninvoiced.id}`);
		await expect(excluded.json()).resolves.toMatchObject({ data: [], meta: { nextCursor: null } });
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
		expect(body.meta).toEqual({ limit: 200, nextCursor: null });
	});

	asUser('Returns 422 for a non-UUID client filter', async () => {
		const res = await app.request('/api/invoices?client=not-a-uuid');
		expect(res.status).toBe(422);
	});
});
