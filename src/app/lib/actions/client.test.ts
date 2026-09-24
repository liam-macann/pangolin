import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import * as navigation from 'next/navigation';
import { afterEach, assert, beforeEach, describe, expect, vi } from 'vitest';

import * as actions from '@/lib/actions/utils';
import { withVault } from '@/lib/encrypt';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { createTestSession, sessionStorage, asUser as test } from '@/test/session';

import { createClient, updateClient, updateClientDeleted, updateClientFavorite } from './client';
import { addressBuilder, clientBuilder } from './tests/builders';
import { insertTestClient } from './tests/fixtures';

/** Fetch the active clientData row (and associated address) for a given client */
const getActiveClientData = (clientId: string) =>
	withRLS(async (db, session) =>
		db.query.clientData.findFirst({
			where: { clientId, userId: session.user.id, validTo: { isNull: true } },
			with: { address: true },
		}),
	);

beforeEach(async () => {
	vi.spyOn(actions, 'cleanupClientData').mockResolvedValue();
	vi.spyOn(actions, 'cleanupAddresses').mockResolvedValue();
});

afterEach(() => vi.restoreAllMocks());
type ClientInput = Parameters<typeof createClient>[0];

/** Wraps the createClient and updateClient actions for use in shared insertion tests */
const saveClientVia: Record<
	'createClient' | 'updateClient',
	(input: ClientInput) => Promise<string>
> = {
	async createClient(input: ClientInput) {
		const existing = await withRLS(db => db.select({ id: tables.clients.id }).from(tables.clients));

		await createClient(input);

		const clients = await withRLS(db => db.select({ id: tables.clients.id }).from(tables.clients));
		const created = clients.find(client => existing.every(({ id }) => id !== client.id));

		assert(created, 'createClient should have inserted a new logical client');
		return created.id;
	},

	async updateClient(input: ClientInput) {
		// Seed with builder defaults so the input under test is only ever handled by updateClient
		const clientId = await saveClientVia.createClient(clientBuilder());

		// Isolate mock assertions (cache tags, cleanup) from the seeding call above
		vi.clearAllMocks();

		await updateClient({ ...input, clientId });
		return clientId;
	},
};

// Applies the same tests to both createClient and updateClient
describe.for(Object.entries(saveClientVia))('Client insertion behaviour: %s', ([, saveClient]) => {
	test('Persists submitted fields on the active data row', async () => {
		const clientId = await saveClient(
			clientBuilder({ name: 'Alaric Wivell', email: 'a-wivell@acme.example' }),
		);

		expect(await getActiveClientData(clientId)).toMatchObject({
			name: 'Alaric Wivell',
			email: 'a-wivell@acme.example',
		});
	});

	test('Empty string name and organization are recorded as null', async () => {
		const first = await saveClient(clientBuilder({ name: '', organization: 'Acme' }));
		expect(await getActiveClientData(first)).toMatchObject({ name: null, organization: 'Acme' });

		const second = await saveClient(clientBuilder({ name: 'Alaric Wivell', organization: '' }));
		expect(await getActiveClientData(second)).toMatchObject({
			name: 'Alaric Wivell',
			organization: null,
		});
	});

	test('Trims whitespace from string values', async () => {
		const clientId = await saveClient(
			clientBuilder({
				name: '  Alaric Wivell  ',
				organization: '  Acme  ',
				email: '  client@acme.example  ',
			}),
		);

		expect(await getActiveClientData(clientId)).toMatchObject({
			name: 'Alaric Wivell',
			organization: 'Acme',
			email: 'client@acme.example',
		});
	});

	test('Inserts and associates an address', async () => {
		const address = addressBuilder({ streetAddress: ['Unit 4', '129 Main Av'] });
		const clientId = await saveClient(clientBuilder({ address }));

		const storedAddress = (await getActiveClientData(clientId))?.address;
		assert(storedAddress, 'Client data should have an associated address');

		const decrypted = await withVault(vault => vault.decryptObject(storedAddress));
		expect(decrypted.streetAddress).toEqual(['Unit 4', '129 Main Av']);
	});

	test('Rejects when neither name nor organization is provided', async () => {
		await expect(saveClient(clientBuilder({ name: null, organization: null }))).rejects.toThrow();

		// Neither of these should throw
		await saveClient(clientBuilder({ name: 'Name', organization: null }));
		await saveClient(clientBuilder({ name: null, organization: 'Org' }));
	});

	test('Invalidates the clients cache tag', async ({ session }) => {
		await saveClient(clientBuilder());
		expect(updateTag).toHaveBeenCalledWith(`clients-${session.user.id}`);
	});
});

// Tests specific only to createClient
describe('createClient', () => {
	test('Inserts a new logical client row', async ({ db, session }) => {
		await createClient(clientBuilder());

		const clients = await db.select().from(tables.clients);
		expect(clients).toHaveLength(1);
		expect(clients[0]).toMatchObject({
			userId: session.user.id,
			isFavorite: false,
			isDeleted: false,
		});
	});
});

// Tests specific only to updateClient
describe('updateClient', () => {
	test('Throws when updating a client that does not exist', async () => {
		await expect(updateClient({ ...clientBuilder(), clientId: randomUUID() })).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();
	});

	test('Does not mutate a client owned by another user', async ({ db, auth }) => {
		const other = await createTestSession(db, auth);
		const otherClient = await sessionStorage.run(other, () =>
			insertTestClient({ organization: null }),
		);

		await expect(
			updateClient({ ...clientBuilder({ organization: 'Hijacked' }), clientId: otherClient.id }),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		const otherData = await sessionStorage.run(other, () => getActiveClientData(otherClient.id));
		expect(otherData).toMatchObject({ organization: null });
	});

	test('Reuses the previous address when unchanged', async ({ db }) => {
		const address = addressBuilder();
		const client = await insertTestClient({ address });

		const first = await getActiveClientData(client.id);
		assert(first?.address, 'Address should have been inserted');

		// The user re-submits the same address on their next save, so the record must be reused
		await updateClient({ ...clientBuilder({ address }), clientId: client.id });

		expect(await db.select().from(tables.address)).toHaveLength(1);

		const second = await getActiveClientData(client.id);
		expect(second?.address?.id).toBe(first.address.id);
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

		expect(actions.cleanupClientData).toHaveBeenCalledWith(session.user.id);
		expect(actions.cleanupAddresses).toHaveBeenCalledWith(session.user.id);
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

	test('Does not mutate a client owned by another user', async ({ db, auth }) => {
		const other = await createTestSession(db, auth);
		const otherClient = await sessionStorage.run(other, () => insertTestClient());

		// notFound() rather than forbidden() to avoid leaking resource existence
		await expect(updateClientFavorite(otherClient.id, true)).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		const [stillUnfavorited] = await sessionStorage.run(other, () =>
			withRLS(db => db.select().from(tables.clients).where(eq(tables.clients.id, otherClient.id))),
		);
		expect(stillUnfavorited.isFavorite).toBe(false);

		// Positive control: the same call succeeds for the owning user
		await sessionStorage.run(other, () => updateClientFavorite(otherClient.id, true));
		const [nowFavorited] = await sessionStorage.run(other, () =>
			withRLS(db => db.select().from(tables.clients).where(eq(tables.clients.id, otherClient.id))),
		);
		expect(nowFavorited.isFavorite).toBe(true);
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

	test('Does not mutate a client owned by another user', async ({ db, auth }) => {
		const other = await createTestSession(db, auth);
		const otherClient = await sessionStorage.run(other, () => insertTestClient());

		// notFound() rather than forbidden() to avoid leaking resource existence
		await expect(updateClientDeleted(otherClient.id, true)).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		const [stillPresent] = await sessionStorage.run(other, () =>
			withRLS(db => db.select().from(tables.clients).where(eq(tables.clients.id, otherClient.id))),
		);
		expect(stillPresent.isDeleted).toBe(false);

		// Positive control: the same call succeeds for the owning user
		await sessionStorage.run(other, () => updateClientDeleted(otherClient.id, true));
		const [nowDeleted] = await sessionStorage.run(other, () =>
			withRLS(db => db.select().from(tables.clients).where(eq(tables.clients.id, otherClient.id))),
		);
		expect(nowDeleted.isDeleted).toBe(true);
	});
});
