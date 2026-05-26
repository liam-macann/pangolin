import { allLocales, base, en, Faker, faker } from '@faker-js/faker';
import { type CountryCode } from 'lib-address';

import { type Transaction } from './../../src/db';
import * as schema from './../../src/db/schema';
import { type SeedCrypto } from './encrypt.ts';

const isLocaleKey = (key: string): key is keyof typeof allLocales => key in allLocales;

function fakerForCountry(country: Exclude<CountryCode, 'ZZ'>): Faker {
	const bySuffix = Object.keys(allLocales)
		// Prefer a locale ending with the provided country (e.g. en_AU, de_AT);
		.filter(k => k.endsWith(`_${country}`))
		// Pick shortest (most generic; excludes script, etc.)
		.sort((a, b) => a.length - b.length);

	// Fallback to lowercase country as language code (ie. DE → de, FR → fr).
	const key = bySuffix[0] ?? country.toLowerCase();

	const locale = isLocaleKey(key) ? allLocales[key] : en;
	const instance = new Faker({ locale: [locale, en, base] });
	instance.seed(42);

	return instance;
}

export async function seedAddress(
	tx: Transaction,
	userId: string,
	crypto: SeedCrypto,
	country = faker.location.countryCode('alpha-2') as Exclude<CountryCode, 'ZZ'>,
): Promise<string> {
	const id = faker.string.uuid();
	const f = fakerForCountry(country);

	const streetAddress = [
		faker.helpers.maybe(() => f.location.secondaryAddress(), { probability: 0.3 }),
		faker.helpers.maybe(() => f.location.streetAddress(), { probability: 0.9 }),
	].filter((v): v is string => v !== undefined);

	await tx.insert(schema.address).values({
		id,
		userId,
		country,
		city: f.location.city(),
		administrativeArea: (() => {
			try {
				return f.location.state({ abbreviated: true });
			} catch {
				return f.location.state();
			}
		})(),
		postalCode: f.location.zipCode(),
		streetAddress: streetAddress.map(crypto.encrypt),
	});

	return id;
}
