import { getCountryDataList } from 'countries-list';
import { type CountryCode } from 'lib-address';
import { z } from 'zod';

// Typing ensures that allowed countries match the expected type of lib-address (both independently reference ISO2 codes)
const validCountryCodes: Exclude<CountryCode, 'ZZ'>[] = getCountryDataList().map(c => c.iso2);
export const country = z.enum(validCountryCodes, 'Invalid country or territory');

const SubRegionMetadata = z
	.looseObject({
		key: z.string().max(512),
		name: z.object({ default: z.string().max(512) }).catchall(z.string().max(512).optional()),
		lname: z.string().max(512).optional(),
		zip: z.string().max(512).optional(),
		zipex: z.string().max(512).optional(),
		get sub_regions() {
			return z.array(SubRegionMetadata).max(2000).optional();
		},
	})
	.meta({
		id: 'SubRegionMetadata',
		ref: 'SubRegionMetadata',
		description: 'Address sub-region metadata for a locality.',
	});

/** Passthrough representation of lib-address per-country metadata. */
export const AddressMetadata = z
	.looseObject({
		id: z.string().max(512),
		key: country,
		name: z.string().max(512),
		lname: z.string().max(512).optional(),
		fmt: z.string().max(512),
		lfmt: z.string().max(512).optional(),
		// This is a regex pattern, not a plain value
		zip: z.string().max(1024).optional(),
		zipex: z.string().max(512).optional(),
		lang: z.string().max(512).optional(),
		upper: z.string().max(512),
		postprefix: z.string().max(512).optional(),
		require: z.string().max(512),
		zip_name_type: z.enum(['eircode', 'pin', 'postal', 'zip']),
		state_name_type: z.enum([
			'area',
			'county',
			'department',
			'district',
			'do si',
			'emirate',
			'island',
			'oblast',
			'parish',
			'prefecture',
			'province',
			'region',
			'state',
		]),
		locality_name_type: z.enum(['city', 'district', 'post town', 'suburb']),
		sublocality_name_type: z.enum([
			'district',
			'neighborhood',
			'suburb',
			'townland',
			'village township',
		]),
		languages: z.string().max(512).optional(),
		isoid: z.string().max(512).optional(),
		sub_regions: z.array(SubRegionMetadata).max(2000).optional(),
	})
	.meta({
		ref: 'AddressMetadata',
		description: 'Address formatting metadata for a country or territory.',
	});

export type AddressMetadata = Readonly<z.infer<typeof AddressMetadata>>;

export const Address = z
	.object({
		/** Street address line(s) */
		streetAddress: z
			.array(z.string().normalize().max(255))
			.max(10)
			.nullable()
			.meta({ description: 'Street address line(s)', examples: [['123 Main St']] }),
		/** Dependent locality (may be an inner-city district or a suburb) */
		dependentLocality: z
			.string()
			.normalize()
			.max(255)
			.nullable()
			.meta({
				description: 'Dependent locality, such as an inner-city district or a suburb',
				examples: ['Building 3'],
			}),
		/** City or locality */
		city: z
			.string()
			.normalize()
			.max(255)
			.nullable()
			.meta({ description: 'City or locality', examples: ['London'] }),
		/** Administrative area, such as a state, province, or archipelago island */
		administrativeArea: z
			.string()
			.normalize()
			.max(255)
			.nullable()
			.meta({
				description: 'Administrative area, such as a state, province, or archipelago island',
				examples: ['Greater London'],
			}),
		/** ZIP or postal code */
		postalCode: z
			.string()
			.normalize()
			.max(255)
			.nullable()
			.meta({ description: 'ZIP or postal code', examples: ['EC1A 1BB'] }),
		/** CEDEX sorting code */
		sortingCode: z
			.string()
			.normalize()
			.max(255)
			.nullable()
			.meta({ description: 'CEDEX sorting code', examples: ['CEDEX 16'] }),
		/** Country or territory */
		country: country.meta({
			description: 'Country or territory code, as defined in ISO 3166-1 alpha-2',
			examples: ['GB'],
		}),
	})
	.meta({ ref: 'Address', description: 'A structured postal address.' });

export type Address = Readonly<z.infer<typeof Address>>;
