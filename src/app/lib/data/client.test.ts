import { randomUUID } from 'node:crypto';
import * as navigation from 'next/navigation';
import { assert, describe, expect } from 'vitest';

import { updateClientDeleted } from '@/lib/actions/client';
import { voidInvoice } from '@/lib/actions/invoice';
import {
	addressBuilder,
	insertTestClient,
	insertTestConfig,
	insertTestInvoice,
	setUpConfigAndClient,
} from '@/lib/actions/tests/helpers';
import { formatAddress } from '@/lib/utils/address';

import { createTestSession, asUser as test } from '@/src/test/session';
import { sessionStorage } from '@/src/test/setup';

import { fetchClientStats, fetchClients } from './client';

describe('fetchClients', () => {
	test('Throws notFound() for a nonexistent client id', async () => {
		await expect(fetchClients(randomUUID())).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();
	});

	test('Throws notFound() when fetching a client with incorrect ownership', async ({
		db,
		auth,
	}) => {
		const otherSession = await createTestSession(db, auth);
		const client = await insertTestClient();

		await expect(sessionStorage.run(otherSession, () => fetchClients(client.id))).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		await expect(fetchClients(client.id)).resolves.not.toThrow();
	});

	test('Lists only non-deleted clients', async () => {
		const kept = await insertTestClient({ name: 'Kept Client' });
		const deleted = await insertTestClient({ name: 'Deleted Client' });
		await updateClientDeleted(deleted.id, true);

		const clients = await fetchClients();
		expect(clients.map(c => c.id)).toEqual([kept.id]);
	});

	test('A deleted client can still be fetched directly by id', async () => {
		const client = await insertTestClient();
		await updateClientDeleted(client.id, true);

		const fetched = await fetchClients(client.id);
		expect(fetched.isDeleted).toBe(true);
	});

	test('Orders clients by organization, falling back to personal name', async () => {
		// Two clients share a null organization, so only a name-based fallback (rather than
		// nulls-last-by-organization alone) can deterministically place them relative to each other
		await insertTestClient({ name: 'Zed Person', organization: null });
		await insertTestClient({ name: 'Alice Person', organization: null });
		await insertTestClient({ name: 'Yara Person', organization: 'Acme Corp' });

		const clients = await fetchClients();
		expect(clients.map(c => c.data.organization ?? c.data.name)).toEqual([
			'Acme Corp',
			'Alice Person',
			'Zed Person',
		]);
	});

	test('Decrypts client fields and computes formattedAddress from the decrypted address', async () => {
		const address = addressBuilder({ streetAddress: ['1 Test St'], city: 'Sydney' });
		const client = await insertTestClient({
			name: 'Alaric Wivell',
			email: 'client@acme.example',
			address,
		});

		const fetched = await fetchClients(client.id);
		expect(fetched.data.name).toBe('Alaric Wivell');
		expect(fetched.data.email).toBe('client@acme.example');

		assert(fetched.data.address, 'Address should be present on the fetched client');
		expect(fetched.data.address.streetAddress).toEqual(['1 Test St']);
		expect(fetched.data.formattedAddress).toBe(formatAddress(fetched.data.address));
	});

	test('formattedAddress is null when the client has no address', async () => {
		const client = await insertTestClient({ address: null });

		const fetched = await fetchClients(client.id);
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

		const fetched = await fetchClients(client.id);
		expect(fetched.invoiceCount).toBe(2);
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
