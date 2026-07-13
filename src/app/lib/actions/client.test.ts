import { eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { assert, beforeEach, describe, expect, vi } from 'vitest';

import { cleanupAddresses, cleanupClientData } from '@/lib/actions/utils';
import { crypto } from '@/lib/encrypt';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { asUser as test } from '@/src/test/session';

import { createClient, updateClient, updateClientDeleted, updateClientFavorite } from './client';
import { addressBuilder, clientBuilder, insertTestClient } from './tests/helpers';

vi.mock('@/lib/actions/utils', () => ({ cleanupClientData: vi.fn(), cleanupAddresses: vi.fn() }));

/** Fetch the active clientData row (and associated address) for a given client */
const getActiveClientData = (clientId: string) =>
	withRLS(async (db, session) =>
		db.query.clientData.findFirst({
			where: { clientId, userId: session.user.id, validTo: { isNull: true } },
			with: { address: true },
		}),
	);

beforeEach(async () => {
	vi.clearAllMocks();
});

describe('createClient', () => {
	test('Inserts a new logical client and associated data', async ({ db, session }) => {
		await createClient(clientBuilder({ name: 'Alaric Wivell', email: 'a-wivell@acme.example' }));

		const clients = await db.select().from(tables.clients);
		expect(clients).toHaveLength(1);
		expect(clients[0]).toMatchObject({
			userId: session.user.id,
			isFavorite: false,
			isDeleted: false,
		});

		const data = await getActiveClientData(clients[0].id);
		expect(data).toMatchObject({ name: 'Alaric Wivell', email: 'a-wivell@acme.example' });
	});

	test('Empty string name and organization are recorded as null', async ({ db }) => {
		await createClient(clientBuilder({ name: '', organization: 'Acme' }));
		await createClient(clientBuilder({ name: 'Alaric Wivell', organization: '' }));

		const data = await db.select().from(tables.clientData);
		expect(data.find(d => d.organization === 'Acme')).toMatchObject({ name: null });
		expect(data.find(d => d.name === 'Alaric Wivell')).toMatchObject({ organization: null });
	});

	test('Trims whitespace from string values', async ({ db }) => {
		await createClient(
			clientBuilder({
				name: '  Alaric Wivell  ',
				organization: '  Acme  ',
				email: '  client@acme.example  ',
			}),
		);

		const [client] = await db.select().from(tables.clients);
		expect(await getActiveClientData(client.id)).toMatchObject({
			name: 'Alaric Wivell',
			organization: 'Acme',
			email: 'client@acme.example',
		});
	});

	test('Rejects when neither name nor organization is provided', async () => {
		await expect(createClient(clientBuilder({ name: null, organization: null }))).rejects.toThrow();

		// Neither of these should throw
		await createClient(clientBuilder({ name: 'Name', organization: null }));
		await createClient(clientBuilder({ name: null, organization: 'Org' }));
	});

	test('Invalidates the clients cache tag', async ({ session }) => {
		await createClient(clientBuilder());
		expect(updateTag).toHaveBeenCalledWith(`clients-${session.user.id}`);
	});
});

describe('updateClientFavorite', () => {
	test('Mutates favorite status', async ({ db }) => {
		const client = await insertTestClient();

		await updateClientFavorite(client.id, true);

		const [res] = await db.select().from(tables.clients).where(eq(tables.clients.id, client.id));
		expect(res.isFavorite).toBe(true);

		await updateClientFavorite(client.id, false);

		const [res2] = await db.select().from(tables.clients).where(eq(tables.clients.id, client.id));
		expect(res2.isFavorite).toBe(false);
	});

	test('Invalidates client cache, scoped to the owning user', async ({ session }) => {
		const client = await insertTestClient();

		await updateClientFavorite(client.id, true);
		expect(updateTag).toHaveBeenCalledWith(`clients-${session.user.id}`);
	});
});

describe('updateClientDeleted', () => {
	test('Mutates deleted status', async ({ db }) => {
		const client = await insertTestClient();

		await updateClientDeleted(client.id, true);

		const [res] = await db.select().from(tables.clients).where(eq(tables.clients.id, client.id));
		expect(res.isDeleted).toBe(true);

		await updateClientDeleted(client.id, false);

		const [res2] = await db.select().from(tables.clients).where(eq(tables.clients.id, client.id));
		expect(res2.isDeleted).toBe(false);
	});

	test('Invalidates client cache, scoped to the owning user', async ({ session }) => {
		const client = await insertTestClient();

		await updateClientDeleted(client.id, true);
		expect(updateTag).toHaveBeenCalledWith(`clients-${session.user.id}`);
	});
});

describe('updateClient', () => {
	test('Inserts and associates a new address with client data', async ({ session }) => {
		const client = await insertTestClient();

		const address = addressBuilder({ streetAddress: ['Unit 4', '129 Main Av'] });
		await updateClient({ ...clientBuilder({ address }), clientId: client.id });

		const data = await getActiveClientData(client.id);
		assert(data?.address, 'Client data should have an associated address');

		const vault = await crypto(session.user.id);

		try {
			const address = await vault.decryptObject(data.address);
			expect(address.streetAddress).toEqual(['Unit 4', '129 Main Av']);
		} finally {
			vault.destroy();
		}
	});

	test('Reuses the previous address when unchanged', async ({ db }) => {
		const client = await insertTestClient();
		const address = addressBuilder();

		await updateClient({ ...clientBuilder({ address }), clientId: client.id });

		const first = await getActiveClientData(client.id);
		assert(first?.address, 'Address should have been inserted');

		// The user re-submits the same address on their next save, so the record must be reused
		await updateClient({ ...clientBuilder({ address }), clientId: client.id });

		expect(await db.select().from(tables.address)).toHaveLength(1);

		const second = await getActiveClientData(client.id);
		expect(second?.address?.id).toBe(first.address.id);
	});

	test('Empty string name and organization are recorded as null', async () => {
		const client = await insertTestClient();

		await updateClient({
			...clientBuilder({ name: '', organization: 'Acme' }),
			clientId: client.id,
		});
		expect(await getActiveClientData(client.id)).toMatchObject({
			name: null,
			organization: 'Acme',
		});

		await updateClient({
			...clientBuilder({ name: 'Alaric Wivell', organization: '' }),
			clientId: client.id,
		});
		expect(await getActiveClientData(client.id)).toMatchObject({
			name: 'Alaric Wivell',
			organization: null,
		});
	});

	test('Trims whitespace from string values', async () => {
		const client = await insertTestClient();

		await updateClient({
			...clientBuilder({
				name: '  Alaric Wivell  ',
				organization: '  Acme  ',
				email: '  client@acme.example  ',
			}),
			clientId: client.id,
		});

		expect(await getActiveClientData(client.id)).toMatchObject({
			name: 'Alaric Wivell',
			organization: 'Acme',
			email: 'client@acme.example',
		});
	});

	test('Invalidates the previous version and leaves exactly one active row', async ({ db }) => {
		const client = await insertTestClient();

		await updateClient({ ...clientBuilder({ organization: 'Acme' }), clientId: client.id });

		const allData = await db
			.select({ id: tables.clientData.id, validTo: tables.clientData.validTo })
			.from(tables.clientData)
			.where(eq(tables.clientData.clientId, client.id));

		// createTestClient inserted a row, and then we updated it
		expect(allData.length).toBe(2);
		expect(allData.filter(d => d.validTo === null)).toHaveLength(1);

		const activeData = await getActiveClientData(client.id);
		expect(activeData).toMatchObject({ organization: 'Acme' });
	});

	test('Schedules cleanup and invalidates cache tags', async ({ session }) => {
		const client = await insertTestClient();

		await updateClient({ ...clientBuilder(), clientId: client.id });

		expect(cleanupClientData).toHaveBeenCalledWith(session.user.id);
		expect(cleanupAddresses).toHaveBeenCalledWith(session.user.id);
		expect(updateTag).toHaveBeenCalledWith(`clients-${session.user.id}`);
		expect(updateTag).toHaveBeenCalledWith(`invoices-${session.user.id}`);
	});
});
