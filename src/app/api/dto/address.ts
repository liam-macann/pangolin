import { getCountryDataList } from 'countries-list';
import { type CountryCode } from 'lib-address';
import { z } from 'zod';

import { type AddressData } from '@/lib/utils/address';

/** Opaque passthrough of lib-address's per-country metadata. */
export const AddressMetadata = z.custom<AddressData>().meta({
	ref: 'AddressMetadata',
	type: 'object',
	description: 'Address formatting metadata for a country or territory.',
});

// Typing ensures that allowed countries match the expected type of lib-address (both independently reference ISO2 codes)
const validCountryCodes: Exclude<CountryCode, 'ZZ'>[] = getCountryDataList().map(c => c.iso2);

export const country = z.enum(validCountryCodes, 'Invalid country or territory');

export const Address = z
	.object({
		/** Street address line(s) */
		streetAddress: z
			.array(z.string())
			.nullable()
			.meta({ description: 'Street address line(s)', examples: [['123 Main St']] }),
		/** Dependent locality (may be an inner-city district or a suburb) */
		dependentLocality: z
			.string()
			.nullable()
			.meta({
				description: 'Dependent locality, such as an inner-city district or a suburb',
				examples: ['Building 3'],
			}),
		/** City or locality */
		city: z
			.string()
			.nullable()
			.meta({ description: 'City or locality', examples: ['London'] }),
		/** Administrative area, such as a state, province, or archipelago island */
		administrativeArea: z
			.string()
			.nullable()
			.meta({
				description: 'Administrative area, such as a state, province, or archipelago island',
				examples: ['Greater London'],
			}),
		/** ZIP or postal code */
		postalCode: z
			.string()
			.nullable()
			.meta({ description: 'ZIP or postal code', examples: ['EC1A 1BB'] }),
		/** CEDEX sorting code */
		sortingCode: z
			.string()
			.nullable()
			.meta({ description: 'CEDEX sorting code', examples: ['CEDEX 16'] }),
		/** Country or territory */
		country: country.meta({
			description: 'Country or territory code, as defined in ISO 3166-1 alpha-2',
			examples: ['GB'],
		}),
	})
	.meta({ ref: 'Address', description: 'A structured postal address.' });

export type Address = z.infer<typeof Address>;
