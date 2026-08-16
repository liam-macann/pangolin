import { createRequire } from 'node:module';
import { registerCountry } from 'lib-address';
import metadataUS from 'lib-address/countries/US.json';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import { fetchAddressMetadata, formatAddress, isAddressEqual } from '@/lib/utils/address';

const require = createRequire(import.meta.url);
beforeAll(() => {
	registerCountry(require('lib-address/countries/AU.json'));
	registerCountry(require('lib-address/countries/DE.json'));
});

const sample = {
	streetAddress: ['1 Test Street'],
	dependentLocality: null,
	city: 'Sydney',
	administrativeArea: 'NSW',
	postalCode: '2000',
	sortingCode: null,
	country: 'AU' as const,
};

vi.mock('lib-address', { spy: true });

describe('fetchAddressMetadata', () => {
	test('Fetches and returns country metadata', async () => {
		await expect(fetchAddressMetadata('US')).resolves.toMatchObject({
			key: 'US',
			fmt: metadataUS.fmt,
			name: metadataUS.name,
		});
	});
});

describe('isAddressEqual', () => {
	test('Compares normalized address values', () => {
		expect(
			isAddressEqual(sample, {
				...sample,
				streetAddress: [' 1 Test Street ', ''],
				postalCode: ' 2000 ',
				dependentLocality: null,
			}),
		).toBe(true);
	});

	test('Detects a difference in a normalized field', () =>
		expect(isAddressEqual(sample, { ...sample, postalCode: ' 2001' })).toBe(false));

	test('Does not consider a missing or structurally invalid address equal', () => {
		expect(isAddressEqual(sample, null)).toBe(false);
		expect(isAddressEqual(sample, { ...sample, country: 'ZZ' as 'AU' })).toBe(false);
	});
});

describe('formatAddress', () => {
	test('Returns null for a missing address', () => {
		expect(formatAddress(null)).toBeNull();
		expect(formatAddress(undefined)).toBeNull();
	});

	test('Formats address fields using the registered country locale', () => {
		expect(formatAddress(sample)).toEqual(expect.stringContaining('1 Test Street'));
		expect(formatAddress(sample)).toContain('SYDNEY NSW 2000');

		expect(formatAddress({ ...sample, country: 'DE' })).not.toContain('SYDNEY NSW 2000');
	});

	test('Includes country name', () => {
		expect(formatAddress(sample).endsWith('AUSTRALIA')).toBe(true);
		expect(formatAddress({ ...sample, country: 'US' }).endsWith('UNITED STATES')).toBe(true);
	});
});
