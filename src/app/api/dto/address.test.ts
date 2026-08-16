import { getCountryCode, getCountryDataList } from 'countries-list';
import { assert, describe, expect, test } from 'vitest';

import { AddressMetadata } from '@/api/dto/address';
import { fetchAddressMetadata } from '@/lib/utils/address';

describe('AddressMetadata', () => {
	test.for(getCountryDataList().map(c => c.name))('Parses "%s" metadata', async country => {
		const code = getCountryCode(country);
		assert(code, `Could not resolve code for ${country}`);

		const metadata = await fetchAddressMetadata(code);
		expect(AddressMetadata.parse(metadata)).toEqual(metadata);
	});
});
