import { after } from 'next/server';
import { afterAll, describe, expect, vi } from 'vitest';

import * as tables from '@/db/schema';

import { asUser as test } from '@/test/session';

import { updateClient } from './client';
import { addressBuilder, clientBuilder } from './tests/builders';
import { insertTestClient, insertTestConfig, insertTestInvoice } from './tests/fixtures';
import { cleanupAddresses, cleanupClientData, cleanupConfigs } from './utils';

const testAddress = addressBuilder({ streetAddress: ['123 Main St'] });

// Prevent seeding calls from running cleanup
vi.mocked(after).mockImplementation(() => undefined);
afterAll(() => vi.mocked(after).mockReset());

describe('cleanupConfigs', () => {
	test('Removes an invalidated config not referenced by any invoice', async ({ db, session }) => {
		await insertTestConfig();
		await insertTestConfig({ tradingName: 'Rebrand' });

		await cleanupConfigs(session.user.id);

		expect(await db.select().from(tables.config)).toHaveLength(1);
	});

	test('Preserves an invalidated config referenced by an invoice', async ({ db, session }) => {
		const {
			data: { scdId: clientDataId },
		} = await insertTestClient();
		await insertTestConfig();
		await insertTestInvoice({ clientDataId });

		// Invalidates the config the invoice above still references
		await insertTestConfig({ tradingName: 'Rebrand' });

		await cleanupConfigs(session.user.id);

		expect(await db.select().from(tables.config)).toHaveLength(2);
	});

	test('Preserves the active config', async ({ db, session }) => {
		await insertTestConfig();

		await cleanupConfigs(session.user.id);

		expect(await db.select().from(tables.config)).toHaveLength(1);
	});
});

describe('cleanupClientData', () => {
	test('Removes invalidated client data not referenced by any invoice', async ({ db, session }) => {
		const { id: clientId } = await insertTestClient();
		await updateClient({ ...clientBuilder({ name: 'Jane Rebrand' }), clientId });

		await cleanupClientData(session.user.id);

		expect(await db.select().from(tables.clientData)).toHaveLength(1);
	});

	test('Preserves invalidated client data referenced by an invoice', async ({ db, session }) => {
		await insertTestConfig();
		const { id: clientId } = await insertTestClient();
		const [{ id: clientDataId }] = await db
			.select({ id: tables.clientData.id })
			.from(tables.clientData);
		await insertTestInvoice({ clientDataId });

		// Invalidates the client data the invoice above still references
		await updateClient({ ...clientBuilder({ name: 'Jane Rebrand' }), clientId });

		await cleanupClientData(session.user.id);

		expect(await db.select().from(tables.clientData)).toHaveLength(2);
	});

	test('Preserves the active client data', async ({ db, session }) => {
		await insertTestClient();

		await cleanupClientData(session.user.id);

		expect(await db.select().from(tables.clientData)).toHaveLength(1);
	});
});

describe('cleanupAddresses', () => {
	test('Removes an address once nothing references it', async ({ db, session }) => {
		await insertTestConfig({ address: testAddress });
		// Invalidates the first config, which still references the address
		await insertTestConfig({ tradingName: 'Rebrand', address: null });

		// Clears the invalidated config row so nothing references the address anymore
		await cleanupConfigs(session.user.id);
		await cleanupAddresses(session.user.id);

		expect(await db.select().from(tables.address)).toHaveLength(0);
	});

	test('Preserves an address referenced by the active config', async ({ db, session }) => {
		await insertTestConfig({ address: testAddress });

		await cleanupAddresses(session.user.id);

		expect(await db.select().from(tables.address)).toHaveLength(1);
	});

	test('Preserves an address referenced by an invalidated, uncleaned config', async ({
		db,
		session,
	}) => {
		await insertTestConfig({ address: testAddress });
		await insertTestConfig({ tradingName: 'Rebrand', address: null });

		await cleanupAddresses(session.user.id);

		expect(await db.select().from(tables.address)).toHaveLength(1);
	});

	test('Preserves an address referenced by client data', async ({ db, session }) => {
		// createClient does not persist an address; use updateClient to associate one
		const { id: clientId } = await insertTestClient();
		await updateClient({ ...clientBuilder({ address: testAddress }), clientId });

		await cleanupAddresses(session.user.id);

		expect(await db.select().from(tables.address)).toHaveLength(1);
	});
});
