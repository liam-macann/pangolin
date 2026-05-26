import { faker } from '@faker-js/faker';

import { type Transaction } from './../../src/db';
import * as schema from './../../src/db/schema';
import { seedAddress } from './address.ts';
import { type SeedCrypto } from './encrypt.ts';
import { generateScdIntervals, type ScdVersion } from './utils.ts';

export async function seedConfig(
	tx: Transaction,
	userId: string,
	taxIds: string[],
	yearCounts: Record<number, number>,
	crypto: SeedCrypto,
): Promise<ScdVersion[]> {
	const locale = () =>
		faker.helpers.arrayElement([
			{ currency: 'AUD', region: 'AU', timezone: 'Australia/Sydney' },
			{ currency: 'USD', region: 'US', timezone: 'America/New_York' },
			{ currency: 'GBP', region: 'GB', timezone: 'Europe/London' },
		]);

	const years = Object.keys(yearCounts).map(Number).sort();
	const intervals = generateScdIntervals(new Date(years[0], 0, 1), years.length);
	const versions: ScdVersion[] = [];

	for (const interval of intervals) {
		const addressId = await seedAddress(tx, userId, crypto, locale().region);

		const configId = faker.string.uuid();
		await tx.insert(schema.config).values({
			id: configId,
			userId,
			tradingName: faker.company.name(),
			email: faker.helpers.maybe(() => crypto.encrypt(faker.internet.email()), {
				probability: 0.7,
			}),
			phone: faker.helpers.maybe(() => crypto.encrypt(faker.phone.number()), { probability: 0.5 }),
			header: faker.helpers.maybe(() => crypto.encrypt(faker.company.catchPhrase()), {
				probability: 0.3,
			}),

			timezone: locale().timezone,
			language: 'en',
			region: locale().region,
			currency: locale().currency,

			taxRegistration: faker.helpers.weightedArrayElement([
				{ weight: 5, value: true },
				{ weight: 1, value: false },
			]),

			addressId,

			paymentDetails: faker.helpers.maybe(
				() =>
					Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () =>
						crypto.encrypt(`${faker.finance.accountName()}: ${faker.finance.accountNumber()}`),
					),
				{ probability: 0.6 },
			),

			tradingNumber: faker.helpers.maybe(
				() =>
					Array.from({ length: faker.number.int({ min: 1, max: 2 }) }, () =>
						crypto.encrypt(
							faker.string.alphanumeric({ length: { min: 8, max: 12 }, casing: 'upper' }),
						),
					),
				{ probability: 0.5 },
			),

			numberingScheme: faker.helpers.arrayElement(schema.numberingScheme.enumValues),
			colorScheme: faker.helpers.arrayElement(schema.colorEnum.enumValues),

			validFrom: interval.validFrom,
			validTo: interval.validTo,
		});

		await tx
			.insert(schema.configTaxes)
			.values(taxIds.map((taxId, i) => ({ configId, taxId, userId, order: i })));

		versions.push({ id: configId, ...interval });
	}

	return versions;
}
