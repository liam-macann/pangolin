import { allLocales, base, en, Faker, FakerError } from '@faker-js/faker';

import { type Address, country as countries } from '@/api/dto/address';
import * as tables from '@/db/schema';
import { type SeedContext } from '@/db/seed/shared/context';

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

/** How a seeded entity comes by its address: built around given values, or one that exists already. */
export type AddressShape =
	| { address: Address | null; addressId?: never }
	| { addressId: string | null; address?: never };

/** Builds an address row around any given values, or no address where they are `null`.
 *  @param fallbackCountry Used where no country is given, instead of a random one. */
export function buildAddress(
	ctx: SeedContext,
	overrides?: Partial<Address> | null,
	fallbackCountry?: Address['country'],
) {
	const { faker, userId, encrypt } = ctx;

	if (overrides === null) return null;
	if (overrides === undefined && !faker.datatype.boolean({ probability: 0.6 })) return null;

	const { country = fallbackCountry ?? faker.helpers.arrayElement(countries.options), ...fields } =
		overrides ?? {};

	const f = fakerForCountry(country, faker.number.int());

	const generated = [
		faker.helpers.maybe(() => safe(() => f.location.secondaryAddress()), { probability: 0.3 }),
		faker.helpers.maybe(() => safe(() => f.location.streetAddress()), { probability: 0.9 }),
	].filter(line => line !== undefined);

	// Default streetAddress to generated value if not explicitly overridden
	const { streetAddress = generated } = fields;

	return {
		id: faker.string.uuid(),
		userId,
		country,
		city: safe(() => f.location.city()),
		administrativeArea:
			safe(() => f.location.state({ abbreviated: true })) ?? safe(() => f.location.state()),
		postalCode: safe(() => f.location.zipCode()),

		...fields,
		streetAddress: streetAddress?.length ? streetAddress.map(encrypt) : null,
	} satisfies typeof tables.address.$inferInsert;
}

/** Inserts the addresses a batch of rows refers to, which must exist before those rows do. */
export async function insertAddresses(
	{ tx }: SeedContext,
	built: { address: ReturnType<typeof buildAddress> }[],
) {
	const addresses = built.flatMap(b => b.address ?? []);
	if (addresses.length > 0) await tx.insert(tables.address).values(addresses);
}
