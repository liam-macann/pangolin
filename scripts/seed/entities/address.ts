import { allLocales, base, en, Faker, FakerError } from '@faker-js/faker';

import { type Address, country as countries } from '@/api/dto/address';
import type * as tables from '@/db/schema';

import { type SeedContext } from './../shared/context';

const isLocaleKey = (key: string): key is keyof typeof allLocales => key in allLocales;

function fakerForCountry(country: Address['country'], seed: number): Faker {
	const bySuffix = Object.keys(allLocales)
		// Prefer a locale ending with the provided country (e.g. en_AU, de_AT);
		.filter(k => k.endsWith(`_${country}`))
		// Pick shortest (most generic; excludes script, etc.)
		.sort((a, b) => a.length - b.length);

	// Fallback to lowercase country as language code (ie. DE → de, FR → fr).
	const key = bySuffix[0] ?? country.toLowerCase();

	const locale = isLocaleKey(key) ? allLocales[key] : en;
	const instance = new Faker({ locale: [locale, en, base] });
	instance.seed(seed);

	return instance;
}

/** Faker throws for data that a locale marks as not applicable */
function safe<T>(generate: () => T) {
	try {
		return generate();
	} catch (error) {
		if (error instanceof FakerError) return undefined;
		throw error;
	}
}

/** Builds an address row, in a random country unless one is given */
export function buildAddress(
	{ faker, userId, encrypt }: SeedContext,
	country = faker.helpers.arrayElement(countries.options),
) {
	const f = fakerForCountry(country, faker.number.int());

	const streetAddress = [
		faker.helpers.maybe(() => safe(() => f.location.secondaryAddress()), { probability: 0.3 }),
		faker.helpers.maybe(() => safe(() => f.location.streetAddress()), { probability: 0.9 }),
	].filter(line => line !== undefined);

	return {
		id: faker.string.uuid(),
		userId,
		country,
		city: safe(() => f.location.city()),
		administrativeArea:
			safe(() => f.location.state({ abbreviated: true })) ?? safe(() => f.location.state()),
		postalCode: safe(() => f.location.zipCode()),
		streetAddress: streetAddress.length ? streetAddress.map(encrypt) : null,
	} satisfies typeof tables.address.$inferInsert;
}
