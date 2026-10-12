import { updateTag } from 'next/cache';
import { after } from 'next/server';
import { afterEach, assert, beforeEach, describe, expect, vi } from 'vitest';

import * as actions from '@/lib/actions/utils';
import { withVault } from '@/lib/encrypt';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { getSession } from '@/auth';
import { asUser as test } from '@/test/session';

import { updateUserConfig } from './config';
import { captureAfter } from './tests/after';
import { addressBuilder, configBuilder } from './tests/builders';

describe('updateUserConfig', () => {
	beforeEach(() => {
		vi.mocked(after).mockImplementation(() => undefined);
		vi.mocked(after).mockClear();
	});

	afterEach(() => vi.restoreAllMocks());

	/** Fetch the active config without processing data */
	const getUserConfig = () =>
		withRLS(async (db, session) =>
			db.query.config
				.findFirst({
					where: { userId: session.user.id, validTo: { isNull: true } },
					with: {
						address: true,
						configTaxes: {
							with: { taxes: { columns: { userId: false } } },
							orderBy: { order: 'asc' },
						},
					},
				})
				.then(res => ({ ...res, taxes: res?.configTaxes.map(i => i.taxes) })),
		);

	test('Converts percentage to fractional tax rates', async () => {
		await updateUserConfig(configBuilder({ taxes: [{ name: 'GST', rate: 15.5 }] }));
		expect(await getUserConfig()).toMatchObject({
			taxes: [{ name: 'GST', rate: '0.1550' }],
		});
	});

	test('Round-trips encrypted scalar and array columns through bytea storage', async () => {
		await updateUserConfig(
			configBuilder({
				email: 'billing@acme.example',
				paymentDetails: [
					{ label: 'BSB', value: '062-000' },
					{ label: 'Account', value: '1234 5678' },
				],
			}),
		);

		const { email, paymentDetails } = await getUserConfig();
		assert(email, 'Active config should now exist with an email value');
		assert(paymentDetails, 'Active config should now exist with payment details');

		await withVault(async vault => {
			expect(await vault.decrypt(email)).toBe('billing@acme.example');
			expect(await vault.decrypt(paymentDetails)).toEqual(['BSB: 062-000', 'Account: 1234 5678']);
		});
	});

	test('Inserts and associates a new address with config', async () => {
		await updateUserConfig(
			configBuilder({ address: addressBuilder({ streetAddress: ['123 Main St'] }) }),
		);

		const { address: storedAddress } = await getUserConfig();
		assert(storedAddress, 'Config should have associated address');

		await withVault(async vault => {
			const address = await vault.decryptDeep(storedAddress);
			expect(address.streetAddress).toEqual(['123 Main St']);
		});
	});

	test('Reuses the previous address when unchanged', async ({ db }) => {
		const address = addressBuilder({ streetAddress: ['123 Main St'] });

		await updateUserConfig(configBuilder({ address }));
		const { address: firstAddress } = await getUserConfig();
		assert(firstAddress, 'Address should have been inserted');

		// The user re-submits the same address on their next save, so the record must be reused
		await updateUserConfig(configBuilder({ address }));

		expect(await db.select().from(tables.address)).toHaveLength(1);

		const { address: secondAddress } = await getUserConfig();
		expect(secondAddress?.id).toBe(firstAddress.id);
	});

	test('Sets addressId to null when no address is provided', async () => {
		await updateUserConfig(configBuilder({ address: null }));
		expect((await getUserConfig())?.addressId).toBeNull();
	});

	test('Skips tax insertion when no taxes are provided', async ({ db }) => {
		await updateUserConfig(configBuilder({ taxRegistration: false, taxes: [] }));

		const taxes = await db.select().from(tables.taxes);
		const configTaxes = await db.select().from(tables.configTaxes);

		expect(taxes).toHaveLength(0);
		expect(configTaxes).toHaveLength(0);
	});

	test('Rejects when tax registration is set without any taxes', async () => {
		await expect(
			updateUserConfig(configBuilder({ taxRegistration: true, taxes: [] })),
		).rejects.toThrow();
	});

	test('Trims whitespace from string values', async () => {
		await updateUserConfig(
			configBuilder({
				tradingName: '  Acme Pty Ltd  ',
				email: '  billing@acme.example  ',
				paymentDetails: [{ label: '  BSB  ', value: '  062-000  ' }],
				taxes: [{ name: '  GST  ', rate: 10 }],
			}),
		);

		const config = await getUserConfig();
		expect(config).toMatchObject({ tradingName: 'Acme Pty Ltd', taxes: [{ name: 'GST' }] });

		const { email, paymentDetails } = config;
		assert(email, 'Active config should now exist with an email value');
		assert(paymentDetails, 'Active config should now exist with payment details');

		await withVault(async vault => {
			expect(await vault.decrypt(email)).toBe('billing@acme.example');
			expect(await vault.decrypt(paymentDetails)).toEqual(['BSB: 062-000']);
		});
	});

	test('Empty string email, phone and header are recorded as null', async () => {
		await updateUserConfig(configBuilder({ email: '', phone: '', header: '' }));

		const config = await getUserConfig();
		expect(config).toMatchObject({ email: null, phone: null, header: null });
	});

	test('Empty paymentDetails and tradingNumber array is recorded as null', async () => {
		await updateUserConfig(configBuilder({ paymentDetails: [], tradingNumber: [] }));

		const config = await getUserConfig();
		expect(config).toMatchObject({ paymentDetails: null, tradingNumber: null });
	});

	test('Invalidates the previous config and leaves exactly one active version', async ({ db }) => {
		await updateUserConfig(configBuilder());
		const firstConfig = await getUserConfig();

		// A second save must invalidate the first
		await updateUserConfig(configBuilder({ tradingName: 'Acme Rebrand' }));

		const allConfigs = await db
			.select({ id: tables.config.id, validTo: tables.config.validTo })
			.from(tables.config);

		// This is true as cleanup does not touch the invalidated config
		expect(allConfigs.length).toBe(2);

		expect(allConfigs.filter(c => c.validTo === null)).toHaveLength(1);
		expect(allConfigs.find(c => c.id === firstConfig?.id)?.validTo).not.toBeNull();

		const activeConfig = await getUserConfig();
		expect(activeConfig).toMatchObject({ tradingName: 'Acme Rebrand' });
	});

	test('Invalidates the config cache tag', async ({ session }) => {
		await updateUserConfig(configBuilder());
		expect(updateTag).toHaveBeenCalledWith(`config-${session.user.id}`);
	});

	test('Schedules cleanup', async ({ session }) => {
		vi.spyOn(actions, 'cleanupConfigs');
		vi.spyOn(actions, 'cleanupAddresses');
		const runAfter = captureAfter();

		await updateUserConfig(configBuilder());

		vi.mocked(getSession).mockClear();
		await runAfter();

		expect(getSession).toHaveBeenCalledTimes(1);
		expect(actions.cleanupConfigs).toHaveBeenCalledWith(session.user.id);
		expect(actions.cleanupAddresses).toHaveBeenCalledWith(session.user.id);
	});
});
