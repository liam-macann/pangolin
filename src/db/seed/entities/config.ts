import type * as DTO from '@/api/dto/config';
import * as tables from '@/db/schema';
import {
	type Overrides,
	type SeedContext,
	type SeedOptions,
	type VersionOptions,
} from '@/db/seed/shared/context';
import { inBuiltOrder, overrideAt, versionIntervals } from '@/db/seed/shared/utils';

import { type AddressShape, buildAddress, insertAddresses } from './address';

const locales = [
	{ currency: 'AUD', region: 'AU', timezone: 'Australia/Sydney' },
	{ currency: 'USD', region: 'US', timezone: 'America/New_York' },
	{ currency: 'GBP', region: 'GB', timezone: 'Europe/London' },
] as const;

/** What may be overridden for a seeded config version. */
type ConfigShape = Pick<
	DTO.Config,
	| 'tradingName'
	| 'email'
	| 'phone'
	| 'header'
	| 'paymentDetails'
	| 'tradingNumber'
	| 'timezone'
	| 'region'
	| 'currency'
	| 'taxRegistration'
	| 'numberingScheme'
	| 'colorScheme'
> &
	AddressShape & { taxes: string[] };

/** Builds one config version. */
function buildConfig(
	ctx: SeedContext,
	validity: ReturnType<typeof versionIntervals>[number],
	{ address: addressOverrides, addressId, taxes, ...overrides }: Overrides<ConfigShape> = {},
) {
	const { faker, encrypt, userId } = ctx;
	const locale = faker.helpers.arrayElement(locales);

	// An address referenced by id already exists, so none is built
	const address =
		addressId === undefined ? buildAddress(ctx, addressOverrides, locale.region) : null;

	const plaintext = {
		id: faker.string.uuid(),
		userId,
		addressId: addressId ?? address?.id,
		...validity,

		tradingName: faker.company.name(),
		email: faker.helpers.maybe(() => faker.internet.email(), { probability: 0.7 }),
		phone: faker.helpers.maybe(() => faker.phone.number(), { probability: 0.5 }),
		header: faker.helpers.maybe(() => faker.company.catchPhrase(), { probability: 0.3 }),

		language: 'en',
		...locale,

		taxRegistration: faker.datatype.boolean({ probability: 5 / 6 }),

		paymentDetails: faker.helpers.maybe(
			() =>
				faker.helpers.multiple(
					() => `${faker.finance.accountName()}: ${faker.finance.accountNumber()}`,
					{ count: { min: 1, max: 3 } },
				),
			{ probability: 0.6 },
		),

		tradingNumber: faker.helpers.maybe(
			() =>
				faker.helpers.multiple(
					() => faker.string.alphanumeric({ length: { min: 8, max: 12 }, casing: 'upper' }),
					{ count: { min: 1, max: 2 } },
				),
			{ probability: 0.5 },
		),

		numberingScheme: faker.helpers.arrayElement(tables.numberingScheme.enumValues),
		colorScheme: faker.helpers.arrayElement(tables.colorEnum.enumValues),

		...overrides,
	};

	const secret = (value?: string | null) => (value == null ? null : encrypt(value));

	// Generated or overridden, secrets are plaintext until here
	const config = {
		...plaintext,
		email: secret(plaintext.email),
		phone: secret(plaintext.phone),
		header: secret(plaintext.header),
		paymentDetails: plaintext.paymentDetails?.map(encrypt) ?? null,
		tradingNumber: plaintext.tradingNumber?.map(encrypt) ?? null,
	} satisfies typeof tables.config.$inferInsert;

	return { address, config, taxes };
}

/** Seeds the config history: consecutive versions.
 * @remarks Offers every seeded tax by default. */
export async function seedConfig(
	ctx: SeedContext,
	options: Omit<SeedOptions<ConfigShape>, 'count'> & VersionOptions = {},
	dependencies: { taxes: { id: string }[] },
) {
	const {
		overrides,
		// Default versions to the length of an overrides array
		versions = Array.isArray(overrides) ? overrides.length : { min: 1, max: 4 },
	} = options;

	const periods = versionIntervals(ctx, versions);
	const history = periods.map((validity, i) =>
		buildConfig(ctx, validity, overrideAt(overrides, i)),
	);

	await insertAddresses(ctx, history);

	// Sort result so that each config lines up with its override
	const configs = inBuiltOrder(
		await ctx.tx
			.insert(tables.config)
			.values(history.map(b => b.config))
			.returning(),
		history.map(b => b.config),
	);

	const taxOverrides = new Map(history.map(b => [b.config.id, b.taxes]));

	const withTaxes = configs.map(config => ({
		...config,
		/** IDs of the taxes this version offers, in order */
		taxes: taxOverrides.get(config.id) ?? dependencies.taxes.map(tax => tax.id),
	}));

	const configTaxes = withTaxes.flatMap(config =>
		config.taxes.map((taxId, order) => ({ configId: config.id, taxId, userId: ctx.userId, order })),
	);

	if (configTaxes.length > 0) await ctx.tx.insert(tables.configTaxes).values(configTaxes);

	return withTaxes;
}
