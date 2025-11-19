// Polyfill
import fetch from 'node-fetch';
import { WebSocket } from 'ws';

globalThis.WebSocket = WebSocket;
globalThis.fetch = fetch;

import { reset, seed } from 'drizzle-seed';
import { db } from './index';
import * as schema from './schema';

// biome-ignore lint/correctness/noUnusedVariables: Discard properties
const { accounts, authenticators, sessions, ...include } = schema;

/** Get user by UUID */
const fetchUser = async (uuid: string) =>
	await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.id, uuid),
		with: { accounts: true, sessions: true },
	});

async function main(uuid?: string) {
	if (process.env.NODE_ENV) {
		throw new Error('Database seeding may not be executed within application');
	}

	const attachedUser = uuid ? await fetchUser(uuid) : undefined;

	await reset(db, include);

	const invoiceCount = 24;
	await seed(db, include, { seed: 42, count: 10, version: '2' }).refine(f => ({
		users: {
			count: 1,
			columns: attachedUser
				? {
						id: f.default({ defaultValue: attachedUser.id }),
						name: f.default({ defaultValue: attachedUser.name }),
						image: f.default({ defaultValue: attachedUser.image }),
						email: f.default({ defaultValue: attachedUser.email }),
						emailVerified: f.default({ defaultValue: attachedUser.emailVerified }),
						password: f.default({ defaultValue: attachedUser.password }),
					}
				: { name: f.fullName() },
			with: {
				clients: 8,
				config: 1,
				invoices: invoiceCount,
			},
		},
		clients: { with: { clientData: 1 } },
		clientData: {
			columns: {
				name: f.fullName(),
				validTo: f.default({ defaultValue: null }),
			},
		},
		invoices: {
			columns: {
				id: f.uuid(),
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
		taxes: {
			count: 3,
			columns: {
				name: f.valuesFromArray({ values: ['GST', 'VAT', 'EXP', 'LCT', 'WET'] }),
				rate: f.number({ precision: 10, minValue: 0, maxValue: 0.3 }),
			},
		},
		config: {
			columns: {
				timezone: f.valuesFromArray({ values: ['Sydney/Australia'] }),
				currency: f.valuesFromArray({ values: ['AUD', 'GBP', 'USD'] }),
				locale: f.valuesFromArray({ values: ['en-AU', 'en-GB', 'en-US'] }),
				validTo: f.default({ defaultValue: null }),
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
			db.insert(accounts).values(attachedUser.accounts),
			db.insert(sessions).values(attachedUser.sessions),
		]);
}

(async () => {
	const input = process.argv.slice(2)[0];

	if (input === undefined)
		throw new Error(
			'Input UUID to link seeded data to an existing account — else enter explicit "false"',
		);

	await main(input === 'false' ? '' : input);
})();
