import * as tables from '@/db/schema';
import { type SeedContext, type SeedOptions, type VersionOptions } from '@/db/seed/shared/context';
import { versionIntervals } from '@/db/seed/shared/utils';

import { buildAddress } from './address';

/** A logical client with every version of its data. */
export type ClientRecord = typeof tables.clients.$inferSelect & {
	versions: (typeof tables.clientData.$inferSelect)[];
};

/** Builds one client with consecutive versions of its details, each at its own address. */
function buildClient(ctx: SeedContext, versions: NonNullable<VersionOptions['versions']>) {
	const { faker, userId } = ctx;

	const client = {
		id: faker.string.uuid(),
		userId,
		isFavorite: faker.datatype.boolean({ probability: 0.2 }),
		isDeleted: faker.datatype.boolean({ probability: 0.1 }),
	} satisfies typeof tables.clients.$inferInsert;

	// The person stays the same across versions, even where a version omits their name
	const person = pickName(ctx);

	const history = versionIntervals(ctx, versions).map(validity => {
		const address = buildAddress(ctx);

		// A client is always identified by a name, an organization, or both.
		// Each is therefore certain where the other is absent, or overridden to nothing.
		const org = faker.helpers.maybe(() => faker.company.name(), {
			probability: 0.6,
		});
		const name = faker.helpers.maybe(() => person, {
			probability: org ? 0.8 : 1,
		});

		const data = {
			id: faker.string.uuid(),
			userId,
			clientId: client.id,
			addressId: address.id,
			...validity,

			name,
			organization: org,
			email: faker.internet.email(),
			notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
		} satisfies typeof tables.clientData.$inferInsert;

		return { address, data };
	});

	return { client, history };
}

export async function seedClients(
	ctx: SeedContext,
	{ count = { min: 8, max: 42 }, versions = { min: 1, max: 3 } }: SeedOptions & VersionOptions = {},
): Promise<ClientRecord[]> {
	const built = ctx.faker.helpers.multiple(() => buildClient(ctx, versions), { count });

	const history = built.flatMap(b => b.history);

	const clients = await ctx.tx
		.insert(tables.clients)
		.values(built.map(b => b.client))
		.returning();

	await ctx.tx.insert(tables.address).values(history.map(v => v.address));

	const clientData = await ctx.tx
		.insert(tables.clientData)
		.values(history.map(v => v.data))
		.returning();

	return clients.map(client => ({
		...client,
		versions: clientData.filter(version => version.clientId === client.id),
	}));
}

/** Favorite names not yet given to a client, for each seeding run. */
const unusedNames = new WeakMap<SeedContext, string[]>();

/** Picks each favorite name once, in a random order, before faker makes up the rest. */
function pickName(ctx: SeedContext) {
	const { faker } = ctx;
	const favorites = unusedNames.get(ctx) ?? faker.helpers.shuffle(names);
	unusedNames.set(ctx, favorites);

	return favorites.pop() ?? faker.person.fullName();
}

/** Fictitious people that clients are named after */
// I grew fond of these names during testing.
// biome-ignore format: Best to keep dense
const names = [
	'Irine Able',           'Giordan Estenson',     'Evely Turnmire',       'Aubriana Dilullo',
	'Burdell Maciag',       'Jahnya Reitano',       'Yoshiyuki Proulx',     'Hebe Gaudioso',
	'Anniyah Budrow',       'Philip Mullenix',      'Yosselin Rhames',      'Ruther Wafford',
	'Clotene Dubow',        'Robben Hammerschmidt', 'Priti Lobell',         'Hamish Heckathorn',
	'Japleen Hlad',         'Zaria Lemery',         'Makhai Faulks',        'Ladene Sullo',
	'Marleigh Shimp',       'Claritza Purdum',      'Fatimata Marseille',   'Mohan Bachus',
	'Denali Kundrat',       'Azariyah Radabaugh',   'Tenoch Lorimer',       'Raylin Bennick',
	'Marshun Defina',       'Gaylynn Declerck',     'Suzzanne Repetti',     'Abiel Mancusi',
	'Markus Lavan',         'Gagik Huntley',        'Sarath Perillo',       'Saulo Amacker',
	'Savir Wagman',         'Sari Malicoat',        'Alaric Wivell',        'Luberta Lynes',
	'Jakyron Caperton',     'Yaritzel Hile',        'Ankita Parkes',        'Uzziel Poovey',
];
