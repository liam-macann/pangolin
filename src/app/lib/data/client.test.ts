import { randomUUID } from 'node:crypto';
import { type DBQueryConfigOrderBy, type GetTableViewFieldSelection } from 'drizzle-orm';
import * as navigation from 'next/navigation';
import { assert, describe, expect } from 'vitest';

import { updateClientDeleted, updateClientFavorite } from '@/lib/actions/client';
import { voidInvoice } from '@/lib/actions/invoice';
import {
	addressBuilder,
	insertTestClient,
	insertTestConfig,
	insertTestInvoice,
	setUpConfigAndClient,
} from '@/lib/actions/tests/helpers';
import { formatAddress } from '@/lib/utils/address';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { createTestSession, sessionStorage, asUser as test } from '@/test/session';

import { fetchClient, fetchClientStats, fetchClients } from './client';

describe('fetchClients', () => {
	test('Throws notFound() for a nonexistent client id', async () => {
		await expect(fetchClient(randomUUID())).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();
	});

	test('Throws notFound() when fetching a client with incorrect ownership', async ({
		db,
		auth,
	}) => {
		const otherSession = await createTestSession(db, auth);
		const client = await insertTestClient();

		await expect(sessionStorage.run(otherSession, () => fetchClient(client.id))).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		await expect(fetchClient(client.id)).resolves.not.toThrow();
	});

	test('Lists only non-deleted clients by default', async () => {
		const kept = await insertTestClient({ name: 'Marleigh Shimp' });
		const deleted = await insertTestClient({ name: 'Burdell Maciag' });
		await updateClientDeleted(deleted.id, true);

		const clients = await fetchClients({ limit: 200 });
		expect(clients.map(c => c.id)).toEqual([kept.id]);
	});

	test('Lists can request deleted clients', async () => {
		await insertTestClient({ name: 'Marleigh Shimp' });
		const deleted = await insertTestClient({ name: 'Burdell Maciag' });
		await updateClientDeleted(deleted.id, true);

		const clients = await fetchClients({
			where: { isDeleted: { eq: true } },
			limit: 200,
		});

		expect(clients.map(c => c.id)).toEqual([deleted.id]);
	});

	test('A deleted client can still be fetched directly by id', async () => {
		const client = await insertTestClient();
		await updateClientDeleted(client.id, true);

		const fetched = await fetchClient(client.id);
		expect(fetched.isDeleted).toBe(true);
	});

	describe('orderBy', () => {
		test('Default orders clients by organization, falling back to personal name', async () => {
			await insertTestClient({ name: 'Zaria Lemery', organization: null });
			await insertTestClient({ name: 'Azariyah Radabaugh', organization: null });
			await insertTestClient({ name: 'Yosselin Rhames', organization: 'Acme Corp' });

			const clients = await fetchClients({ limit: 200 });
			expect(clients.map(c => c.data.organization ?? c.data.name)).toEqual([
				'Acme Corp',
				'Azariyah Radabaugh',
				'Zaria Lemery',
			]);
		});

		test('Allows overriding the orderBy defaults', async () => {
			const azariyah = await insertTestClient({ name: 'Azariyah Radabaugh' });
			const zaria = await insertTestClient({ name: 'Zaria Lemery' });
			await updateClientFavorite(zaria.id, true);

			const clientsDefault = await fetchClients({ limit: 200 });
			expect(clientsDefault.map(c => c.id)).toEqual([azariyah.id, zaria.id]);

			const clientsOverride = await fetchClients({ limit: 200, orderBy: { isFavorite: 'desc' } });
			expect(clientsOverride.map(c => c.id)).toEqual([zaria.id, azariyah.id]);
		});

		test.for<
			[
				string,
				DBQueryConfigOrderBy<
					typeof tables.clients,
					GetTableViewFieldSelection<typeof tables.clients>
				>,
			]
		>([
			['object', { isFavorite: 'desc' }],
			['callback', (client, { desc }) => desc(client.isFavorite)],
		])('Allows extending the orderBy defaults with %s-form', async ([_, orderBy]) => {
			const zaria = await insertTestClient({ name: 'Zaria Lemery' });
			const azariyah = await insertTestClient({ name: 'Azariyah Radabaugh' });
			const yosselin = await insertTestClient({ name: 'Yosselin Rhames' });
			await updateClientFavorite(zaria.id, true);
			await updateClientFavorite(azariyah.id, true);

			const clients = await fetchClients({ limit: 200, orderBy });
			expect(clients.map(c => c.id)).toEqual([azariyah.id, zaria.id, yosselin.id]);
		});
	});

	test('Decrypts client fields and computes formattedAddress from the decrypted address', async () => {
		const address = addressBuilder({ streetAddress: ['1 Test St'], city: 'Sydney' });
		const client = await insertTestClient({
			name: 'Alaric Wivell',
			email: 'client@acme.example',
			address,
		});

		const fetched = await fetchClient(client.id);
		expect(fetched.data.name).toBe('Alaric Wivell');
		expect(fetched.data.email).toBe('client@acme.example');

		assert(fetched.data.address, 'Address should be present on the fetched client');
		expect(fetched.data.address.streetAddress).toEqual(['1 Test St']);
		expect(fetched.data.formattedAddress).toBe(formatAddress(fetched.data.address));
	});

	test('formattedAddress is null when the client has no address', async () => {
		const client = await insertTestClient({ address: null });

		const fetched = await fetchClient(client.id);
		expect(fetched.data.address).toBeNull();
		expect(fetched.data.formattedAddress).toBeNull();
	});

	test('invoiceCount includes voided invoices', async () => {
		const { client } = await setUpConfigAndClient();

		await insertTestInvoice({
			clientDataId: client.data.scdId,
			items: [{ quantity: 1, unitCost: 100 }],
		});
		const voided = await insertTestInvoice({
			clientDataId: client.data.scdId,
			items: [{ quantity: 1, unitCost: 100 }],
		});
		await voidInvoice(voided);

		const fetched = await fetchClient(client.id);
		expect(fetched.invoiceCount).toBe(2);
	});

	test('invoiceCount excludes documents that are not invoices', async () => {
		const { configId, client } = await setUpConfigAndClient();

		await insertTestInvoice({
			clientDataId: client.data.scdId,
			items: [{ quantity: 1, unitCost: 100 }],
		});

		// A floating document has no invoice referencing it, and should not be counted
		await withRLS(async (db, session) =>
			db.insert(tables.documents).values({
				userId: session.user.id,
				clientDataId: client.data.scdId,
				configId,
			}),
		);

		expect((await fetchClient(client.id)).invoiceCount).toBe(1);
	});
});

describe('fetchClientStats', () => {
	test('Scopes stats to the given client only', async () => {
		await insertTestConfig();
		const clientA = await insertTestClient();
		const clientB = await insertTestClient();

		await insertTestInvoice({
			clientDataId: clientA.data.scdId,
			items: [{ quantity: 1, unitCost: 100 }],
		});
		await insertTestInvoice({
			clientDataId: clientB.data.scdId,
			items: [{ quantity: 1, unitCost: 50 }],
		});

		const stats = await fetchClientStats(clientA.id);
		expect(stats.validCount).toBe(1);
		expect(stats.totals).toEqual([
			expect.objectContaining({
				currency: 'AUD',
				netSum: 100,
				grossSum: 100,
				grossOutstanding: 100,
			}),
		]);
	});

	test('Returns a zero count and null totals when the client has no invoices', async () => {
		const client = await insertTestClient();

		const stats = await fetchClientStats(client.id);
		expect(stats).toEqual({ validCount: 0, totals: null });
	});
});
