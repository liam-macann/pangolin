import { getCountryDataList } from 'countries-list';
import {
	AddressValidationError,
	CountryMissingError,
	getCountryFields,
	getCountrySubdivisions,
	getOptionalFields,
	getRegisteredCountries,
	InvalidStateError,
	InvalidZipError,
	InvalidZipSubRegionError,
	isAddressError,
	type AnyAddress as LibAddress,
	MissingFieldError,
	validateAddress,
} from 'lib-address';
import z from 'zod';

import { type Address } from '@/api/dto/address';
import { fetchAddressMetadata } from '@/lib/utils/address';

// Typing ensures that allowed countries match the expected type of lib-address (both independently reference ISO2 codes)
const validCountryCodes: Address['country'][] = getCountryDataList().map(c => c.iso2);

/** Performs locale-unaware structural validation */
export const transform = z.object({
	streetAddress: z
		.array(
			z
				.string()
				.trim()
				.max(255, 'Too long')
				.refine(str => !str.includes('\n'), 'Must not contain newline characters'),
		)
		.max(3, 'No more than 3 lines allowed')
		.transform(lines => {
			// Trim final empty lines
			while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
			return lines;
		})
		.refine(
			// Refinement applies to top-level, not individual lines
			lines => !lines.reduce((acc, line) => acc || line.length === 0, false),
			'Lines may not be empty',
		)
		.nullish()
		.transform(v => v || undefined),
	dependentLocality: z
		.string()
		.trim()
		.max(255, 'Too long')
		.nullish()
		.transform(v => v || undefined),
	city: z
		.string()
		.trim()
		.max(255, 'Too long')
		.nullish()
		.transform(v => v || undefined),
	administrativeArea: z
		.string()
		.trim()
		.max(255, 'Too long')
		.nullish()
		.transform(v => v || undefined),
	postalCode: z
		.string()
		.trim()
		.max(20, 'Too long')
		.nullish()
		.transform(v => v || undefined),
	sortingCode: z
		.string()
		.trim()
		.max(20, 'Too long')
		.nullish()
		.transform(v => v || undefined),
	country: z.enum(validCountryCodes, 'Invalid country or territory'),
});

//
//
// LOCALE-AWARE ADDRESS VALIDATION
//
//

type SchemaOutput = z.output<typeof transform>;

/** Lookup object to map input schema to validation input format */
const libFieldMap = {
	zip: 'postalCode',
	state: 'administrativeArea',
	addressLine1: 'streetAddress',
	addressLine2: 'streetAddress',
	addressLine3: 'streetAddress',
} satisfies Partial<Record<keyof LibAddress, keyof SchemaOutput>>;

/** For a given key, returns the mapped value type (schema adapter) */
type MapLookup<K extends keyof LibAddress> = K extends keyof typeof libFieldMap
	? SchemaOutput[(typeof libFieldMap)[K]]
	: K extends keyof SchemaOutput
		? SchemaOutput[K]
		: never;

/** Zod validation schema for postal addresses. Use .parseAsync() to ensure address metadata is present. */
export const schema = transform
	// SWR hook includes validation registration, so data should already be registered when parsing front-end form.
	// Server registers each country at build time, in API route.
	.transform(async val => {
		const registered = getRegisteredCountries().map(c => c.value);
		if (!registered.includes(val.country)) await fetchAddressMetadata(val.country);
		return val;
	})
	// Ensure only relevant fields are present for the country
	.transform(val => {
		// Get required and optional fields for the country
		const fields = new Set(
			Object.entries(getCountryFields(val.country))
				.filter(([_, required]) => !!required)
				.map(([key]) => key)
				.map(key => (libFieldMap as Record<string, string>)[key] ?? key),
		);

		// Strip fields not allowable for country
		const minimal: SchemaOutput = {
			// Spread ensures that type inference works
			...val,
			// Set invalid fields to undefined
			...Object.fromEntries(
				Object.keys(val)
					.filter(key => !fields.has(key))
					.map(key => [key, undefined]),
			),
			country: val.country,
		};

		return minimal;
	})
	.superRefine(async (val, ctx) => {
		/** Accepts a key of lib-address input, and returns the corresponding value in the input schema */
		function getProp<K extends keyof LibAddress>(key: K): MapLookup<K> {
			const resolvedKey = (libFieldMap as Record<string, keyof SchemaOutput>)[key] ?? key;
			return val[resolvedKey] as MapLookup<K>;
		}

		/** Mapped object that meets validation schema */
		const input = {
			country: getProp('country'),
			addressLine1: getProp('addressLine1')?.[0],
			addressLine2: getProp('addressLine2')?.[1],
			addressLine3: getProp('addressLine3')?.slice(2).join('\n'),
			dependentLocality: getProp('dependentLocality'),
			city: getProp('city'),
			state: getProp('state'),
			zip: getProp('zip'),
			sortingCode: getProp('sortingCode'),
		};

		try {
			validateAddress(input);
		} catch (err) {
			// If country data is missing, or function throws non-lib error, rethrow
			if (!isAddressError(err) || err instanceof CountryMissingError) throw err;

			if (err instanceof AddressValidationError) {
				err.errors.forEach(e => {
					if (e instanceof MissingFieldError) {
						ctx.addIssue({
							code: 'invalid_type',
							expected: 'string',
							received: 'undefined',
							message: 'Required',
							path: [(libFieldMap as Record<string, keyof SchemaOutput>)[e.field] ?? e.field],
						});
					}

					if (e instanceof InvalidZipError) {
						const optionalFields = getOptionalFields(input.country);
						// If zip is optional and empty, ignore the error
						if (!(optionalFields.includes('zip') && input.zip === undefined)) {
							if (e instanceof InvalidZipSubRegionError) {
								// Different subregions (eg. state) may have different validation formats
								ctx.addIssue({
									code: 'invalid_format',
									format: e.subRegionFormat,
									message: "Code doesn't match region",
									path: [libFieldMap.zip ?? 'zip'],
								});
							} else {
								ctx.addIssue({
									code: 'invalid_format',
									format: e.format,
									message: 'Invalid',
									path: [libFieldMap.zip ?? 'zip'],
								});
							}
						}
					}

					if (e instanceof InvalidStateError) {
						const states = getCountrySubdivisions(input.country);

						// Ensure there are valid states, else accept arbitrary input
						if (states.length > 0) {
							ctx.addIssue({
								code: 'invalid_value',
								values: states.map(v => v.value),
								input: input.state,
								path: [libFieldMap.state ?? 'state'],
								message: 'Invalid',
							});
						}
					}
				});
			}
		}
	});

export default schema;
