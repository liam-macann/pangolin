import * as tables from '@/db/schema';
import { type SeedContext, type VersionOptions } from '@/db/seed/shared/context';
import { versionIntervals } from '@/db/seed/shared/utils';

import { buildAddress } from './address';

const locales = [
	{ currency: 'AUD', region: 'AU', timezone: 'Australia/Sydney' },
	{ currency: 'USD', region: 'US', timezone: 'America/New_York' },
	{ currency: 'GBP', region: 'GB', timezone: 'Europe/London' },
] as const;

/** Builds one config version. */
function buildConfig(ctx: SeedContext, validity: ReturnType<typeof versionIntervals>[number]) {
	const { faker, encrypt, userId } = ctx;
	const locale = faker.helpers.arrayElement(locales);
	const address = buildAddress(ctx, locale.region);

	const config = {
		id: faker.string.uuid(),
		userId,
		addressId: address.id,
		...validity,

		tradingName: faker.company.name(),
		email: faker.helpers.maybe(() => encrypt(faker.internet.email()), { probability: 0.7 }),
		phone: faker.helpers.maybe(() => encrypt(faker.phone.number()), { probability: 0.5 }),
		header: faker.helpers.maybe(() => encrypt(faker.company.catchPhrase()), { probability: 0.3 }),

		language: 'en',
		...locale,

		taxRegistration: faker.datatype.boolean({ probability: 5 / 6 }),

		paymentDetails: faker.helpers.maybe(
			() =>
				faker.helpers.multiple(
					() => encrypt(`${faker.finance.accountName()}: ${faker.finance.accountNumber()}`),
					{ count: { min: 1, max: 3 } },
				),
			{ probability: 0.6 },
		),

		tradingNumber: faker.helpers.maybe(
			() =>
				faker.helpers.multiple(
					() =>
						encrypt(faker.string.alphanumeric({ length: { min: 8, max: 12 }, casing: 'upper' })),
					{ count: { min: 1, max: 2 } },
				),
			{ probability: 0.5 },
		),

		numberingScheme: faker.helpers.arrayElement(tables.numberingScheme.enumValues),
		colorScheme: faker.helpers.arrayElement(tables.colorEnum.enumValues),
	} satisfies typeof tables.config.$inferInsert;

	return { address, config };
}

/** Seeds the config history: consecutive versions, each offering every tax */
export async function seedConfig(
	ctx: SeedContext,
	{ versions = 3 }: VersionOptions = {},
	dependencies: { taxes: { id: string }[] },
) {
	const { tx, userId } = ctx;
	const built = versionIntervals(ctx, versions).map(validity => buildConfig(ctx, validity));

	await tx.insert(tables.address).values(built.map(b => b.address));
	const configs = await tx
		.insert(tables.config)
		.values(built.map(b => b.config))
		.returning();

	const withTaxes = configs.map(config => ({
		...config,
		/** IDs of the taxes this version offers, in order */
		taxes: dependencies.taxes.map(tax => tax.id),
	}));

	const configTaxes = withTaxes.flatMap(config =>
		config.taxes.map((taxId, order) => ({ configId: config.id, taxId, userId, order })),
	);

	await tx.insert(tables.configTaxes).values(configTaxes);

	return withTaxes;
}
