import { updateTag } from 'next/cache';
import { assert, beforeEach, describe, expect, vi } from 'vitest';
import z from 'zod/v4';

import { cleanupAddresses, cleanupConfigs } from '@/lib/actions/utils';
import { crypto } from '@/lib/encrypt';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { asUser as test } from '@/src/test/session';

import { updateUserConfig } from './config';

// lib-address (imported transitively by the address schema) fails to load under Vitest
vi.mock('@/lib/validation/address', () => ({ default: z.unknown() }));
// Real comparison logic depends on the mocked module above, so control it directly instead
vi.mock('@/lib/utils/address', () => ({ isAddressEqual: vi.fn(() => false) }));

vi.mock('@/lib/actions/utils', () => ({ cleanupConfigs: vi.fn(), cleanupAddresses: vi.fn() }));

const baseInput = {
	tradingName: 'Acme Pty Ltd',
	email: undefined,
	phone: undefined,
	header: undefined,
	timezone: 'Australia/Sydney',
	language: 'en',
	region: 'AU',
	currency: 'AUD',
	taxRegistration: false,
	paymentDetails: [],
	tradingNumber: [],
	numberingScheme: 'sequential',
	colorScheme: 'blue',
	address: null,
	taxes: [],
} satisfies z.input<typeof configInput>;

const testAddress = {
	streetAddress: ['123 Main St'],
	dependentLocality: undefined,
	city: 'Sydney',
	administrativeArea: undefined,
	postalCode: '2000',
	sortingCode: undefined,
	country: 'AU',
} satisfies NonNullable<z.input<typeof configInput>['address']>;

describe('updateUserConfig', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
	});

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
		await updateUserConfig({ ...baseInput, taxes: [{ name: 'GST', rate: 15.5 }] });
		expect(await getUserConfig()).toMatchObject({
			taxes: [{ name: 'GST', rate: 0.155 }],
		});
	});

	test('Round-trips encrypted scalar and array columns through bytea storage', async ({
		session,
	}) => {
		await updateUserConfig({
			...baseInput,
			email: 'billing@acme.example',
			paymentDetails: [
				{ label: 'BSB', value: '062-000' },
				{ label: 'Account', value: '1234 5678' },
			],
		});

		const config = await getUserConfig();
		assert(config?.email, 'Active config should now exist with an email value');
		assert(config.paymentDetails, 'Active config should now exist with payment details');

		const vault = await crypto(session.user.id);
		try {
			expect(await vault.decrypt(config.email)).toBe('billing@acme.example');
			expect(await vault.decrypt(config.paymentDetails)).toEqual([
				'BSB: 062-000',
				'Account: 1234 5678',
			]);
		} finally {
			vault.destroy();
		}
	});

	test('Inserts and associates a new address with config', async ({ session }) => {
		await updateUserConfig({ ...baseInput, address: testAddress });

		const config = await getUserConfig();

		assert(config.address, 'Config should have associated address');
		const vault = await crypto(session.user.id);

		try {
			const address = await vault.decryptObject(config.address);
			expect(address.streetAddress).toEqual(['123 Main St']);
		} finally {
			vault.destroy();
		}
	});

	test('Reuses the previous address when unchanged', async ({ db }) => {
		const address = testAddress;

		await updateUserConfig({ ...baseInput, address });
		const { address: firstAddress } = await getUserConfig();
		assert(firstAddress, 'Address should have been inserted');

		// The user re-submits the same address on their next save, so the record must be reused
		await updateUserConfig({ ...baseInput, address });

		expect(await db.select().from(tables.address)).toHaveLength(1);

		const { address: secondAddress } = await getUserConfig();
		expect(secondAddress?.id).toBe(firstAddress.id);
	});

	test('Sets addressId to null when no address is provided', async () => {
		await updateUserConfig({ ...baseInput, address: null });
		expect((await getUserConfig())?.addressId).toBeNull();
	});

	test('Skips tax insertion when no taxes are provided', async ({ db }) => {
		await updateUserConfig({ ...baseInput, taxRegistration: false, taxes: [] });

		const taxes = await db.select().from(tables.taxes);
		const configTaxes = await db.select().from(tables.configTaxes);

		expect(taxes).toHaveLength(0);
		expect(configTaxes).toHaveLength(0);
	});

	test('Rejects when tax registration is set without any taxes', async () => {
		await expect(
			updateUserConfig({ ...baseInput, taxRegistration: true, taxes: [] }),
		).rejects.toThrow();
	});

	test('Empty paymentDetails and tradingNumber array is recorded as null', async () => {
		await updateUserConfig({ ...baseInput, paymentDetails: [], tradingNumber: [] });

		const config = await getUserConfig();
		expect(config).toMatchObject({ paymentDetails: null, tradingNumber: null });
	});

	test('Invalidates the previous config and leaves exactly one active version', async ({ db }) => {
		await updateUserConfig(baseInput);
		const firstConfig = await getUserConfig();

		// A second save must invalidate the first
		await updateUserConfig({ ...baseInput, tradingName: 'Acme Rebrand' });

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

	test('Schedules cleanup and invalidates the config cache tag', async ({ session }) => {
		await updateUserConfig(baseInput);

		expect(cleanupConfigs).toHaveBeenCalledWith(session.user.id);
		expect(cleanupAddresses).toHaveBeenCalledWith(session.user.id);
		expect(updateTag).toHaveBeenCalledWith(`config-${session.user.id}`);
	});
});
