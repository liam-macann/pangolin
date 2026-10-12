import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import * as navigation from 'next/navigation';
import { after } from 'next/server';
import { afterEach, assert, beforeEach, describe, expect, vi } from 'vitest';

import * as actions from '@/lib/actions/utils';
import { withVault } from '@/lib/encrypt';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { getSession } from '@/auth';
import { bypassRLS, createTestSession, sessionStorage, asUser as test } from '@/test/session';

import { createClient, updateClient, updateClientDeleted, updateClientFavorite } from './client';
import { addressBuilder, clientBuilder } from './tests/builders';

/** Fetch the active clientData row (and associated address) for a given client */
const getActiveClientData = (clientId: string) =>
	withRLS(async (db, session) =>
		db.query.clientData.findFirst({
			where: { clientId, userId: session.user.id, validTo: { isNull: true } },
			with: { address: true },
		}),
	);

beforeEach(() => {
	vi.mocked(after).mockImplementation(() => undefined);
	vi.mocked(after).mockClear();
});

afterEach(() => vi.restoreAllMocks());
type ClientInput = Parameters<typeof createClient>[0];

/** Wraps the createClient and updateClient actions for use in shared insertion tests */
const saveClientVia: Record<
	'createClient' | 'updateClient',
	(input: ClientInput) => Promise<string>
> = {
	async createClient(input: ClientInput) {
		const { id } = await createClient(input);
		return id;
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
			clientBuilder({
				name: '  Alaric Wivell',
				organization: ' Acme  ',
				email: '  client@acme.example  ',
			}),
		);

		// Values should be trimmed
		expect(await getActiveClientData(clientId)).toMatchObject({
			name: 'Alaric Wivell',
			organization: 'Acme',
			email: 'client@acme.example',
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

	test('Inserts and associates an address', async () => {
		const address = addressBuilder({ streetAddress: ['Unit 4', '129 Main Av'] });
		const clientId = await saveClient(clientBuilder({ address }));

		const storedAddress = (await getActiveClientData(clientId))?.address;
		assert(storedAddress, 'Client data should have an associated address');

		const decrypted = await withVault(vault => vault.decryptDeep(storedAddress));
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

	test('Does not mutate a client owned by another user', async ({ auth, seed }) => {
		const other = await createTestSession(auth);
		const [otherClient] = await seed({ userId: other.user.id }).clients({ count: 1 });

		const getOtherData = () => sessionStorage.run(other, () => getActiveClientData(otherClient.id));
		const seeded = await getOtherData(); // Capture what was seeded

		const input = { ...clientBuilder({ organization: 'Hijacked' }), clientId: otherClient.id };
		await expect(bypassRLS(() => updateClient(input))).rejects.toThrow(); // Checks that withRLS is not the only protection
		expect(navigation.notFound).toHaveBeenCalled();

		expect(await getOtherData()).toEqual(seeded);
	});

	test('Reuses the previous address when unchanged', async ({ db, seed }) => {
		const address = addressBuilder();
		const [client] = await seed.clients({
			count: 1,
			versions: 1, // Each version is seeded with its own address row
			overrides: { data: { address } },
		});

		const first = await getActiveClientData(client.id);
		assert(first?.address, 'Address should have been inserted');

		// The user re-submits the same address on their next save, so the record must be reused
		await updateClient({ ...clientBuilder({ address }), clientId: client.id });

		expect(await db.select().from(tables.address)).toHaveLength(1);

		const second = await getActiveClientData(client.id);
		expect(second?.address?.id).toBe(first.address.id);
	});

	test('Invalidates the previous version and leaves exactly one active row', async ({
		db,
		seed,
	}) => {
		const [client] = await seed.clients({ count: 1, versions: 1 });

		await updateClient({ ...clientBuilder({ organization: 'Acme' }), clientId: client.id });

		const allData = await db
			.select({ id: tables.clientData.id, validTo: tables.clientData.validTo })
			.from(tables.clientData)
			.where(eq(tables.clientData.clientId, client.id));

		// One version was seeded, and then we updated it
		expect(allData.length).toBe(2);
		expect(allData.filter(d => d.validTo === null)).toHaveLength(1);

		const activeData = await getActiveClientData(client.id);
		expect(activeData).toMatchObject({ organization: 'Acme' });
	});

	test('Schedules cleanup', async ({ session, seed }) => {
		const [client] = await seed.clients({ count: 1 });
		vi.spyOn(actions, 'cleanupClientData');
		vi.spyOn(actions, 'cleanupAddresses');
		let deferred: (() => unknown) | undefined;
		vi.mocked(after).mockImplementation(callback => {
			if (typeof callback === 'function') deferred = AsyncLocalStorage.bind(callback);
		});

		await updateClient({ ...clientBuilder(), clientId: client.id });

		vi.mocked(getSession).mockClear();
		assert(deferred, 'Expected cleanup to be scheduled');
		await deferred();

		expect(getSession).toHaveBeenCalledTimes(1);
		expect(actions.cleanupClientData).toHaveBeenCalledWith(session.user.id);
		expect(actions.cleanupAddresses).toHaveBeenCalledWith(session.user.id);
	});
});

describe('updateClientFavorite', () => {
	test('Mutates favorite status', async ({ db, seed }) => {
		const [client] = await seed.clients({ count: 1 });

		await updateClientFavorite(client.id, true);

		const [res] = await db.select().from(tables.clients).where(eq(tables.clients.id, client.id));
		expect(res.isFavorite).toBe(true);

		await updateClientFavorite(client.id, false);

		const [res2] = await db.select().from(tables.clients).where(eq(tables.clients.id, client.id));
		expect(res2.isFavorite).toBe(false);
	});

	test('Invalidates client cache, scoped to the owning user', async ({ session, seed }) => {
		const [client] = await seed.clients({ count: 1 });

		await updateClientFavorite(client.id, true);
		expect(updateTag).toHaveBeenCalledWith(`clients-${session.user.id}`);
	});

	test('Does not mutate a client owned by another user', async ({ auth, seed }) => {
		const other = await createTestSession(auth);
		const [otherClient] = await seed({ userId: other.user.id }).clients({
			overrides: [{ isFavorite: false }],
		});

		// notFound() rather than forbidden() to avoid leaking resource existence.
		// Bypassing RLS checks that withRLS is not the only protection
		await expect(bypassRLS(() => updateClientFavorite(otherClient.id, true))).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		const [unchanged] = await sessionStorage.run(other, () =>
			withRLS(db => db.select().from(tables.clients).where(eq(tables.clients.id, otherClient.id))),
		);
		expect(unchanged.isFavorite).toBe(false);
	});
});

describe('updateClientDeleted', () => {
	test('Mutates deleted status', async ({ db, seed }) => {
		const [client] = await seed.clients({ count: 1 });

		await updateClientDeleted(client.id, true);

		const [res] = await db.select().from(tables.clients).where(eq(tables.clients.id, client.id));
		expect(res.isDeleted).toBe(true);

		await updateClientDeleted(client.id, false);

		const [res2] = await db.select().from(tables.clients).where(eq(tables.clients.id, client.id));
		expect(res2.isDeleted).toBe(false);
	});

	test('Invalidates client cache, scoped to the owning user', async ({ session, seed }) => {
		const [client] = await seed.clients({ count: 1 });

		await updateClientDeleted(client.id, true);
		expect(updateTag).toHaveBeenCalledWith(`clients-${session.user.id}`);
	});

	test('Does not mutate a client owned by another user', async ({ auth, seed }) => {
		const other = await createTestSession(auth);
		const [otherClient] = await seed({ userId: other.user.id }).clients({
			overrides: [{ isDeleted: false }],
		});

		// notFound() rather than forbidden() to avoid leaking resource existence.
		// Bypassing RLS checks that withRLS is not the only protection
		await expect(bypassRLS(() => updateClientDeleted(otherClient.id, true))).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		const [unchanged] = await sessionStorage.run(other, () =>
			withRLS(db => db.select().from(tables.clients).where(eq(tables.clients.id, otherClient.id))),
		);
		expect(unchanged.isDeleted).toBe(false);
	});
});
