import { randomUUID } from 'node:crypto';
import { type DBQueryConfigOrderBy, type FieldSelection } from 'drizzle-orm';
import * as navigation from 'next/navigation';
import { assert, describe, expect } from 'vitest';

import { formatAddress } from '@/lib/utils/address';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { bypassRLS, createTestSession, sessionStorage, asUser as test } from '@/test/session';

import { fetchClient, fetchClientStats, fetchClients } from './client';

describe('fetchClients', () => {
	test('Throws notFound() for a nonexistent client id', async () => {
		await expect(fetchClient(randomUUID())).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();
	});

	test('Throws notFound() when fetching a client with incorrect ownership', async ({
		auth,
		seed,
	}) => {
		const other = await createTestSession(auth);
		const [client] = await seed.clients({ count: 1 });

		// Checks that withRLS is not the only protection
		await expect(
			bypassRLS(() => sessionStorage.run(other, () => fetchClient(client.id))),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		await expect(fetchClient(client.id)).resolves.not.toThrow();
	});

	test('Lists only non-deleted clients by default', async ({ seed }) => {
		const [kept] = await seed.clients({
			overrides: [{ isDeleted: false }, { isDeleted: true }],
		});

		const clients = await fetchClients({ limit: 200 });
		expect(clients.map(c => c.id)).toEqual([kept.id]);
	});

	test('Lists can request deleted clients', async ({ seed }) => {
		const [_kept, deleted] = await seed.clients({
			overrides: [{ isDeleted: false }, { isDeleted: true }],
		});

		const clients = await fetchClients({
			where: { isDeleted: { eq: true } },
			limit: 200,
		});

		expect(clients.map(c => c.id)).toEqual([deleted.id]);
	});

	test('A deleted client can still be fetched directly by id', async ({ seed }) => {
		const [client] = await seed.clients({ overrides: [{ isDeleted: true }] });

		const fetched = await fetchClient(client.id);
		expect(fetched.isDeleted).toBe(true);
	});

	describe('orderBy', () => {
		test('Default orders clients by organization, falling back to personal name', async ({
			seed,
		}) => {
			await seed.clients({
				overrides: [
					{ isDeleted: false, data: { name: 'Zaria Lemery', organization: null } },
					{ isDeleted: false, data: { name: 'Azariyah Radabaugh', organization: null } },
					{ isDeleted: false, data: { name: 'Yosselin Rhames', organization: 'Acme Corp' } },
				],
			});

			const clients = await fetchClients({ limit: 200 });
			expect(clients.map(c => c.data.organization ?? c.data.name)).toEqual([
				'Acme Corp',
				'Azariyah Radabaugh',
				'Zaria Lemery',
			]);
		});

		test('Allows overriding the orderBy defaults', async ({ seed }) => {
			const [a, z] = await seed.clients({
				overrides: [
					{
						isDeleted: false,
						isFavorite: false,
						data: { name: 'Azariyah Radabaugh', organization: null },
					},
					{
						isDeleted: false,
						isFavorite: true,
						data: { name: 'Zaria Lemery', organization: null },
					},
				],
			});

			const clientsDefault = await fetchClients({ limit: 200 });
			expect(clientsDefault.map(c => c.id)).toEqual([a.id, z.id]);

			const clientsOverride = await fetchClients({ limit: 200, orderBy: { isFavorite: 'desc' } });
			expect(clientsOverride.map(c => c.id)).toEqual([z.id, a.id]);
		});

		test.for<[string, DBQueryConfigOrderBy<typeof tables.clients, FieldSelection>]>([
			['object', { isFavorite: 'desc' }],
			['callback', (client, { desc }) => desc(client.isFavorite)],
		])('Allows extending the orderBy defaults with %s-form', async ([_, orderBy], { seed }) => {
			const [zaria, azariyah, yosselin] = await seed.clients({
				overrides: [
					{
						isDeleted: false,
						isFavorite: true,
						data: { name: 'Zaria Lemery', organization: null },
					},
					{
						isDeleted: false,
						isFavorite: true,
						data: { name: 'Azariyah Radabaugh', organization: null },
					},
					{
						isDeleted: false,
						isFavorite: false,
						data: { name: 'Yosselin Rhames', organization: null },
					},
				],
			});

			const clients = await fetchClients({ limit: 200, orderBy });
			expect(clients.map(c => c.id)).toEqual([azariyah.id, zaria.id, yosselin.id]);
		});
	});

	test('Decrypts client fields', async ({ seed }) => {
		const [client] = await seed.clients({
			overrides: [
				{
					data: {
						name: 'Alaric Wivell',
						email: 'client@acme.example',
						address: { streetAddress: ['1 Test St'] },
					},
				},
			],
		});

		const fetched = await fetchClient(client.id);
		expect(fetched.data.name).toBe('Alaric Wivell');
		expect(fetched.data.email).toBe('client@acme.example');

		assert(fetched.data.address, 'Address should be present on the fetched client');
		expect(fetched.data.address.streetAddress).toEqual(['1 Test St']);
	});

	test('formattedAddress is derived from decrypted address', async ({ seed }) => {
		const [clientA, clientB] = await seed.clients({
			overrides: [{ data: { address: null } }, { data: { address: { country: 'AU' } } }],
		});

		const { data: noAddress } = await fetchClient(clientA.id);
		expect(noAddress.address).toBeNull();
		expect(noAddress.formattedAddress).toBeNull();

		const { data: withAddress } = await fetchClient(clientB.id);
		expect(withAddress.formattedAddress).toBe(formatAddress(withAddress.address));
	});

	test('invoiceCount includes voided invoices', async ({ seed }) => {
		const [client] = await seed.clients({ count: 1, versions: 1 });

		await seed.invoices({
			overrides: [
				{ clientDataId: client.versions[0].id, status: { isVoid: true } },
				{ clientDataId: client.versions[0].id, status: { isVoid: false } },
			],
		});

		const fetched = await fetchClient(client.id);
		expect(fetched.invoiceCount).toBe(2);
	});

	test('invoiceCount excludes documents that are not invoices', async ({ seed }) => {
		const [client] = await seed.clients({ count: 1, versions: 1 });
		const clientData = client.versions[0];

		const [config] = await seed.config({ versions: 1 });
		await seed.invoices({ overrides: [{ clientDataId: clientData.id }] });

		// A floating document has no invoice referencing it, and should not be counted
		await withRLS(async (db, session) =>
			db.insert(tables.documents).values({
				userId: session.user.id,
				clientDataId: clientData.id,
				configId: config.id,
			}),
		);

		expect((await fetchClient(client.id)).invoiceCount).toBe(1);
	});
});

describe('fetchClientStats', () => {
	test('Scopes stats to the given client only', async ({ seed }) => {
		await seed.config({ overrides: [{ currency: 'AUD' }] });

		const [clientA, clientB] = await seed.clients({ count: 2, versions: 1 });
		const status = { status: 'unpaid', isVoid: false } as const;

		await seed.invoices({
			overrides: [
				{
					clientDataId: clientA.versions[0].id,
					status,
					items: [{ quantity: '1', unitCost: '100', taxes: [] }],
				},
				{
					clientDataId: clientB.versions[0].id,
					status,
					items: [{ quantity: '1', unitCost: '50', taxes: [] }],
				},
			],
		});

		const statsA = await fetchClientStats(clientA.id);
		expect(statsA.validCount).toBe(1);
		expect(statsA.totals).toEqual([
			expect.objectContaining({
				currency: 'AUD',
				netSum: '100.0000',
				grossSum: '100.0000',
				grossOutstanding: '100.0000',
			}),
		]);
	});

	test('Returns a zero count and null totals when the client has no invoices', async ({ seed }) => {
		const [client] = await seed.clients({ count: 1 });

		const stats = await fetchClientStats(client.id);
		expect(stats).toEqual({ validCount: 0, totals: null });
	});
});
