import { type CountryCode, getRegisteredCountries, registerCountry } from 'lib-address';

import { _getAddressMetadata, type AddressData } from '@/lib/actions/address';

import { formatAddressLib } from './lib';

export type { AddressData };

/** Fetches address formatting metadata, and registers for schema validation.
 *
 * This may be accessed from the client or server, but uses a POST request internally and
 * so does not support client-side caching. A `fetch()` call to the API route is recommended. */
export async function fetchAddressMetadata(country: CountryCode) {
	const data = await _getAddressMetadata(country);

	// Register in calling environment (either client or server)
	registerCountry(data);

	return data;
}

import { isDeepStrictEqual } from 'node:util';
import { type z } from 'zod';

import { transform as structuralSchema } from '@/lib/validation/address';

type Address = z.input<typeof structuralSchema>;

/** Accepts two unencrypted addresses and returns true if they are equal.
 *
 * @remarks Nullish values are not treated as equal. User ownership is not considered. */
export function isAddressEqual(a?: Address | null, b?: Address | null) {
	if (!a || !b) return false;

	// Transform addresses to normalized form before comparing
	const { error: errorA, data: transformedA } = structuralSchema.safeParse(a);
	const { error: errorB, data: transformedB } = structuralSchema.safeParse(b);

	if (errorA || errorB) return false;

	const key = structuralSchema.keyof().options;
	return key.every(key => isDeepStrictEqual(transformedA[key], transformedB[key]));
}

export async function formatAddress(address: Address) {
	const {
		streetAddress,
		dependentLocality,
		city,
		administrativeArea,
		postalCode,
		sortingCode,
		country,
	} = address;

	const registered = getRegisteredCountries().map(c => c.value);

	if (!registered.includes(country)) {
		// SWR hook includes validation registration, so data should already be registered when parsing front-end form.
		// Server registers each country at build time, in API route.
		await fetchAddressMetadata(country);
	}

	return formatAddressLib(
		{
			addressLine1: streetAddress?.join('\n'),
			dependentLocality: dependentLocality ?? undefined,
			city: city ?? undefined,
			state: administrativeArea ?? undefined,
			zip: postalCode ?? undefined,
			sortingCode: sortingCode ?? undefined,
			country: country,
		},
		{ useStateISOCode: true, appendCountry: true, useLatin: true, lang: 'en' },
	);
}
