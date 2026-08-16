'use server';

import { type getCountryData, isValidCountryCode, registerCountry } from 'lib-address';
import { cacheLife } from 'next/cache';

import { type Address, type AddressMetadata } from '@/api/dto/address';

type Input = ReturnType<typeof getCountryData>;

// Helper type to replace underscores in string literals
type ReplaceUnderscore<S extends string> = S extends `${infer Head}_${infer Tail}`
	? `${Head} ${ReplaceUnderscore<Tail>}`
	: S;

const replaceUnderscore = <T extends string>(value: T): ReplaceUnderscore<T> =>
	(value || '').replaceAll('_', ' ') as ReplaceUnderscore<T>;

/** Server action that returns transformed address metadata
 *
 * This may be accessed from the client or server, but uses a POST request and so does
 * not support client-side caching. A `fetch()` call to the API route is recommended.
 * @internal
 */
export async function _getAddressMetadata(country: Address['country']): Promise<AddressMetadata> {
	'use cache';
	cacheLife('max');

	if (!isValidCountryCode(country)) throw new Error('Invalid country code');
	const data: Input = {
		...ZZ,
		...(await import(`lib-address/countries/${country}.json`)),
	};

	const transformed = {
		...data,
		key: country,
		/** What the locality is referred to as locally */
		locality_name_type: replaceUnderscore(data.locality_name_type),
		/** What the dependent locality is referred to as locally */
		sublocality_name_type: replaceUnderscore(data.sublocality_name_type),
		/** What the ZIP or postal code is referred to as locally */
		zip_name_type: replaceUnderscore(data.zip_name_type),
		/** What the administrative area is referred to as locally */
		state_name_type: replaceUnderscore(data.state_name_type),
	};

	// Register country on server
	registerCountry(transformed);

	return transformed;
}

// Google AddressValidationMetadata API:
// "If a particular value is missing for a country, the data/ZZ value can be read instead."

const ZZ = {
	// id: 'data/ZZ',
	fmt: '%N%n%O%n%A%n%C',
	require: 'AC',
	upper: 'C',
	zip_name_type: 'postal',
	state_name_type: 'province',
	locality_name_type: 'city',
	sublocality_name_type: 'suburb',
} as const;
