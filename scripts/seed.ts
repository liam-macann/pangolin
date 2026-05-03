// Polyfill
import fetch from 'node-fetch';
import { WebSocket } from 'ws';

// biome-ignore lint/suspicious/noExplicitAny: Necessary for polyfill. Script does not run in production
globalThis.WebSocket = WebSocket as any;
// biome-ignore lint/suspicious/noExplicitAny: Necessary for polyfill. Script does not run in production
globalThis.fetch = fetch as any;

import { Pool } from '@neondatabase/serverless';
import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { reset, seed } from 'drizzle-seed';

import { relations } from './../src/db/relations.ts';

import './../env-config.ts';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, relations });

import * as schema from './../src/db/schema';

const { timezones, currencies, keychain, ...tables } = schema;

async function main(uuid?: string) {
	if (process.env.NODE_ENV) {
		throw new Error('Database seeding may not be executed within application');
	}

	db.transaction(async tx => {
		/** Get user by UUID */
		const fetchUser = async (uuid: string) =>
			await tx.query.users.findFirst({
				where: { id: uuid },
				with: { accounts: true, sessions: true },
			});

		const attachedUser = uuid ? await fetchUser(uuid) : undefined;

		await reset(tx, tables);

		const invoiceCount = 200;
		await seed(tx, tables, { seed: 42, version: '2' }).refine(f => ({
			users: {
				count: 1,
				columns: attachedUser
					? {
							id: f.default({ defaultValue: attachedUser.id }),
							name: f.default({ defaultValue: attachedUser.name }),
							image: f.default({ defaultValue: attachedUser.image }),
							email: f.default({ defaultValue: attachedUser.email }),
							emailVerified: f.default({ defaultValue: attachedUser.emailVerified }),
						}
					: { name: f.fullName() },
				with: {
					clients: 2,
					config: 1,
					invoices: 1,
					taxes: 5,
					invoiceCount: 1,
				},
			},
			clients: {
				columns: {
					isFavorite: f.weightedRandom([
						{ weight: 0.2, value: f.default({ defaultValue: true }) },
						{ weight: 0.8, value: f.default({ defaultValue: false }) },
					]),
					isDeleted: f.weightedRandom([
						{ weight: 0.1, value: f.default({ defaultValue: true }) },
						{ weight: 0.9, value: f.default({ defaultValue: false }) },
					]),
				},
				with: { clientData: 1 },
			},
			clientData: {
				columns: {
					name: f.fullName(),
					validFrom: f.date({ maxDate: new Date(Date.now()) }),
					validTo: f.date({ maxDate: new Date(Date.now()) }),
				},
			},
			invoices: {
				columns: {
					description: f.weightedRandom([
						{ weight: 0.2, value: f.loremIpsum({ sentencesCount: 3 }) },
						{ weight: 0.8, value: f.default({ defaultValue: '' }) },
					]),
					index: f.intPrimaryKey(),
					yearIndex: f.intPrimaryKey(),
					issuedAt: f.date({ maxDate: new Date(Date.now()) }),
					isVoid: f.weightedRandom([
						{ weight: 0.2, value: f.default({ defaultValue: true }) },
						{ weight: 0.8, value: f.default({ defaultValue: false }) },
					]),
					dueAt: f.date({
						minDate: new Date(),
						maxDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					}),
				},
				with: {
					invoiceItems: [
						{ weight: 0.6, count: [3, 4, 5] },
						{ weight: 0.3, count: [6, 7, 8, 9, 15, 22, 100] },
						{ weight: 0.1, count: [1, 2] },
					],
				},
			},
			invoiceItems: {
				columns: {
					unitCost: f.number({ precision: 100, minValue: 0, maxValue: 70 }),
					label: f.valuesFromArray({
						values: [
							'Apple',
							'Apricot',
							'Banana',
							'Blackberry',
							'Blueberry',
							'Cantaloupe',
							'Cherry',
							'Coconut',
							'Cranberry',
							'Dragonfruit',
							'Durian',
							'Fig',
							'Grape',
							'Guava',
							'Honeydew',
							'Kiwi',
							'Lemon',
							'Lime',
							'Lychee',
							'Mango',
							'Nectarine',
							'Orange',
							'Papaya',
							'Peach',
							'Pear',
							'Pineapple',
							'Plum',
							'Pomegranate',
							'Raspberry',
							'Strawberry',
							'Tangerine',
							'Watermelon',
							'Yuzu',
						],
					}),
					note: f.weightedRandom([
						{ weight: 0.2, value: f.string() },
						{ weight: 0.8, value: f.default({ defaultValue: '' }) },
					]),
					quantity: f.int({ minValue: 1, maxValue: 30 }),
					order: f.int({ minValue: 0 }),
				},
				with: { itemTaxes: 1 },
			},
			address: {
				columns: {
					streetAddress: f.default({ defaultValue: [] }),
					dependentLocality: f.city(),
					city: f.city(),
					administrativeArea: f.state(),
					postalCode: f.postcode(),
					sortingCode: f.default({ defaultValue: null }),
					country: f.country(),
				},
			},
			config: {
				columns: {
					// timezone: f.valuesFromArray({ values: ['Australia/Sydney'] }),
					currency: f.valuesFromArray({ values: ['AUD', 'GBP', 'USD'] }),

					language: f.valuesFromArray({ values: ['en'] }),
					region: f.valuesFromArray({ values: ['AU', 'GB', 'US'] }),

					email: f.default({ defaultValue: null }),
					phone: f.default({ defaultValue: null }),
					header: f.default({ defaultValue: null }),

					tradingName: f.companyName(),

					paymentDetails: f.default({ defaultValue: [] }),
					registrationNumber: f.default({ defaultValue: [] }),

					validFrom: f.date({ maxDate: new Date(Date.now()) }),
					validTo: f.date({ maxDate: new Date(Date.now()) }),
				},
				with: { configTaxes: 1 },
			},
			taxes: {
				columns: {
					name: f.valuesFromArray({ values: ['GST', 'VAT', 'EXP', 'LCT', 'WET'] }),
					rate: f.number({ precision: 10, minValue: 0, maxValue: 0.3 }),
				},
			},
			invoiceCount: {
				columns: {
					count: f.default({ defaultValue: invoiceCount }),
					yearCount: f.default({ defaultValue: invoiceCount }),
				},
			},
		}));

		if (attachedUser?.accounts.length)
			await Promise.all([
				tx
					.update(schema.config)
					.set({ validTo: null })
					.where(
						eq(
							schema.config.id,
							tx
								.select({ id: schema.config.id })
								.from(schema.config)
								.orderBy(desc(schema.config.validFrom))
								.limit(1),
						),
					),
				tx.insert(schema.accounts).values(attachedUser.accounts),
				tx.insert(schema.sessions).values(attachedUser.sessions),
			]);
	});
}

(async () => {
	const input = process.argv.slice(2)[0];

	if (input === undefined)
		throw new Error(
			'Input UUID to link seeded data to an existing account — else enter explicit "false"',
		);

	await main(input === 'false' ? '' : input);
})();
