// Polyfill
import fetch from 'node-fetch';
import { WebSocket } from 'ws';

// biome-ignore lint/suspicious/noExplicitAny: Necessary for polyfill. Script does not run in production
globalThis.WebSocket = WebSocket as any;
// biome-ignore lint/suspicious/noExplicitAny: Necessary for polyfill. Script does not run in production
globalThis.fetch = fetch as any;

import { desc, eq } from 'drizzle-orm';
import { reset, seed } from 'drizzle-seed';
// Temporary. This breaks determinism, but the Drizzle uuid func does not adhere to spec:
// https://github.com/drizzle-team/drizzle-orm/issues/3690
import { v4 as uuidv4 } from 'uuid';
import { db } from '../src/db';
import * as schema from '../src/db/schema';

const { currencies, ...tables } = schema;

const generateIds = (count: number) => ({
	values: Array.from({ length: count }, () => uuidv4()),
	isUnique: true,
});

const generateDates = (count: number) => ({
	values: Array.from({ length: count }, () => new Date().toISOString()),
	isUnique: true,
});

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
		await seed(tx, tables, { seed: 42, count: 1, version: '2' }).refine(f => ({
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
					clients: 1,
					config: 1,
					keychain: 1,
					invoices: invoiceCount,
				},
			},
			clients: {
				count: 1,
				columns: {
					id: f.valuesFromArray(generateIds(600)),
					userId: f.uuid(),
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
					id: f.valuesFromArray(generateIds(100)),
					userId: f.uuid(),
					clientId: f.uuid(),
					name: f.fullName(),
					validFrom: f.date({ maxDate: new Date(Date.now()) }),
					validTo: f.valuesFromArray(generateDates(100)),
				},
			},
			invoices: {
				columns: {
					id: f.valuesFromArray(generateIds(invoiceCount)),
					userId: f.uuid(),
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
					configId: f.uuid(),
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
					configId: f.uuid(),
				},
				with: { itemTaxes: 1 },
			},
			config: {
				columns: {
					userId: f.uuid(),
					timezone: f.valuesFromArray({ values: ['Australia/Sydney'] }),
					currency: f.valuesFromArray({ values: ['AUD', 'GBP', 'USD'] }),
					locale: f.valuesFromArray({ values: ['en-AU', 'en-GB', 'en-US'] }),
					validFrom: f.date({ maxDate: new Date(Date.now()) }),
					validTo: f.valuesFromArray({ values: [new Date().toISOString()], isUnique: true }),
				},
				with: { configTaxes: 3 },
			},
			configTaxes: {
				columns: { configId: f.uuid() },
			},
			taxes: {
				columns: {
					id: f.valuesFromArray(generateIds(48)),
					name: f.valuesFromArray({ values: ['GST', 'VAT', 'EXP', 'LCT', 'WET'] }),
					rate: f.number({ precision: 10, minValue: 0, maxValue: 0.3 }),
				},
			},
			invoiceCount: {
				count: 1,
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
