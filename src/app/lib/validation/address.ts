import {
	type Address,
	AddressValidationError,
	type CountryCode,
	CountryMissingError,
	getCountrySubdivisions,
	getOptionalFields,
	getRegisteredCountries,
	InvalidStateError,
	InvalidZipError,
	InvalidZipSubRegionError,
	isAddressError,
	MissingFieldError,
	validateAddress,
} from 'lib-address';
import z from 'zod';
import { fetchAddressMetadata } from '@/lib/utils/address';

export const transform = z.object({
	streetAddress: z
		.array(z.string())
		.transform(lines => {
			// Trim final empty lines
			while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
			return lines;
		})
		.nullish()
		.transform(v => v ?? undefined),
	dependentLocality: z
		.string()
		.nullish()
		.transform(v => (v === null || v === '' ? undefined : v)),
	city: z
		.string()
		.nullish()
		.transform(v => (v === null || v === '' ? undefined : v)),
	administrativeArea: z
		.string()
		.nullish()
		.transform(v => (v === null || v === '' ? undefined : v)),
	postalCode: z
		.string()
		.nullish()
		.transform(v => (v === null || v === '' ? undefined : v)),
	sortingCode: z
		.string()
		.nullish()
		.transform(v => (v === null || v === '' ? undefined : v)),
	country: z.string<Exclude<CountryCode, 'ZZ'>>('Please select a country or territory'),
});

/** Zod validation schema for postal addresses. Use .parseAsync() to ensure address metadata is present. */
export const schema = transform.superRefine(async (val, ctx) => {
	/** Lookup object to map input schema to validation input format */
	const map = {
		zip: 'postalCode',
		state: 'administrativeArea',
		addressLine1: 'streetAddress',
		addressLine2: 'streetAddress',
		addressLine3: 'streetAddress',
	} satisfies Partial<Record<keyof Address, keyof typeof val>>;

	/** For a given key, returns the mapped value type (schema adapter) */
	type MapLookup<K extends keyof Address> = K extends keyof typeof map
		? (typeof val)[(typeof map)[K]]
		: K extends keyof typeof val
			? (typeof val)[K]
			: never;

	/** Accepts a key of lib-address input, and returns the corresponding value in the input schema */
	function getProp<K extends keyof Address>(key: K): MapLookup<K> {
		const resolvedKey = (map as Record<string, keyof typeof val>)[key] ?? key;
		return val[resolvedKey] as MapLookup<K>;
	}

	/** Mapped object that meets validation schema */
	const input = {
		country: getProp('country') as CountryCode,
		name: getProp('name'),
		organization: getProp('organization'),
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
		const registered = getRegisteredCountries().map(c => c.value);

		if (!registered.includes(input.country)) {
			// SWR hook includes validation registration, so data should already be registered when parsing front-end form.
			// Server registers each country at build time, in API route.
			await fetchAddressMetadata(input.country);
		}

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
						path: [(map as Record<string, keyof typeof val>)[e.field] ?? e.field],
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
								path: [map.zip],
							});
						} else {
							ctx.addIssue({
								code: 'invalid_format',
								format: e.format,
								message: 'Invalid',
								path: [map.zip],
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
							path: [map.state],
							message: 'Invalid',
						});
					}
				}
			});
		}
	}
});

export default schema;
