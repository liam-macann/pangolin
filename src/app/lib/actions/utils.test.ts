import { assert, describe, expect } from 'vitest';

import * as tables from '@/db/schema';

import { asUser as test } from '@/test/session';

import { cleanupAddresses, cleanupClientData, cleanupConfigs } from './utils';

describe('cleanupConfigs', () => {
	test('Removes invalidated and unreferenced configs', async ({ db, session, seed }) => {
		const active = (await seed.config({ versions: 4 })).find(config => config.validTo === null);
		assert(active, 'Seeded config should have an active version');

		await cleanupConfigs(session.user.id);

		const remaining = await db.select({ id: tables.config.id }).from(tables.config);
		expect(remaining).toEqual([{ id: active.id }]);
	});

	test('Preserves invalidated config referenced by an invoice', async ({ db, session, seed }) => {
		const [invalidated] = await seed.config({ versions: 2 });

		// Created while the first version was active, so the invoice still references it
		await seed.invoices({ overrides: [{ createdAt: invalidated.validFrom }] });

		await cleanupConfigs(session.user.id);

		expect(await db.select().from(tables.config)).toHaveLength(2);
	});
});

describe('cleanupClientData', () => {
	test('Removes invalidated and unreferenced client data', async ({ db, session, seed }) => {
		const [client] = await seed.clients({ count: 1, versions: 5 });
		const active = client.versions.find(version => version.validTo === null);
		assert(active, 'Seeded client should have an active version');

		await cleanupClientData(session.user.id);

		const remaining = await db.select({ id: tables.clientData.id }).from(tables.clientData);
		expect(remaining).toEqual([{ id: active.id }]);
	});

	test('Preserves invalidated client data referenced by invoice', async ({ db, session, seed }) => {
		const [client] = await seed.clients({ count: 1, versions: 2 });
		const invalidated = client.versions[0];
		expect(invalidated.validTo, 'First version should have been superseded').not.toBeNull();

		// Created while the first version was active, so the invoice still references it
		await seed.invoices({ overrides: [{ createdAt: invalidated.validFrom }] });

		await cleanupClientData(session.user.id);

		expect(await db.select().from(tables.clientData)).toHaveLength(2);
	});
});

describe('cleanupAddresses', () => {
	test('Removes an address once nothing references it', async ({ db, session, seed }) => {
		// Only the first version has an address, and the second invalidates it
		await seed.config({ overrides: [{ address: {} }, { address: null }] });

		// Clears the invalidated config row so nothing references the address anymore
		await cleanupConfigs(session.user.id);
		await cleanupAddresses(session.user.id);

		expect(await db.select().from(tables.address)).toHaveLength(0);
	});

	test('Preserves an address referenced by the active config', async ({ db, session, seed }) => {
		await seed.config({ overrides: [{ address: {} }] });

		await cleanupAddresses(session.user.id);

		expect(await db.select().from(tables.address)).toHaveLength(1);
	});

	test('Preserves an address referenced by an invalidated, uncleaned config', async ({
		db,
		session,
		seed,
	}) => {
		await seed.config({ overrides: [{ address: {} }, { address: null }] });

		await cleanupAddresses(session.user.id);

		expect(await db.select().from(tables.address)).toHaveLength(1);
	});

	test('Preserves an address referenced by client data', async ({ db, session, seed }) => {
		await seed.clients({ count: 1, versions: 1, overrides: { data: { address: {} } } });

		await cleanupAddresses(session.user.id);

		expect(await db.select().from(tables.address)).toHaveLength(1);
	});
});
