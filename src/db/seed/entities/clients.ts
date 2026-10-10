import { type NumberOrRange } from '@faker-js/faker';

import type * as DTO from '@/api/dto/client';
import * as tables from '@/db/schema';
import {
	type Overrides,
	type SeedContext,
	type SeedOptions,
	type VersionOptions,
} from '@/db/seed/shared/context';
import { inBuiltOrder, overrideAt, versionIntervals } from '@/db/seed/shared/utils';

import { type AddressShape, buildAddress, insertAddresses } from './address';

/** A logical client with every version of its data. */
export type ClientRecord = typeof tables.clients.$inferSelect & {
	versions: (typeof tables.clientData.$inferSelect)[];
};

/** What may be overridden for a seeded client; data overrides apply to every version */
type ClientShape = Pick<DTO.Client, 'isFavorite' | 'isDeleted'> & {
	data: Pick<DTO.Client['data'], 'name' | 'organization' | 'email' | 'notes'> & AddressShape;
};

/** Builds one client with consecutive versions of its details, each at its own address. */
function buildClient(
	ctx: SeedContext,
	versions: NumberOrRange,
	{
		data: { address: addressOverrides, addressId, ...dataOverrides } = {},
		...overrides
	}: Overrides<ClientShape> = {},
) {
	const { faker, userId } = ctx;

	const client = {
		id: faker.string.uuid(),
		userId,
		isFavorite: faker.datatype.boolean({ probability: 0.2 }),
		isDeleted: faker.datatype.boolean({ probability: 0.1 }),
		...overrides,
	} satisfies typeof tables.clients.$inferInsert;

	// The person stays the same across versions, even where a version omits their name
	const person = pickName(ctx);

	const history = versionIntervals(ctx, versions).map(validity => {
		// An address referenced by id already exists, so none is built
		const address = addressId === undefined ? buildAddress(ctx, addressOverrides) : null;

		// A client is always identified by a name, an organization, or both.
		// Each is therefore certain where the other is absent, or overridden to nothing.
		const org = faker.helpers.maybe(() => faker.company.name(), {
			probability: dataOverrides.name === null ? 1 : 0.6,
		});
		const name = faker.helpers.maybe(() => person, {
			probability: org && dataOverrides.organization !== null ? 0.8 : 1,
		});

		const data = {
			id: faker.string.uuid(),
			userId,
			clientId: client.id,
			addressId: addressId ?? address?.id,
			...validity,

			name,
			organization: org,
			email: faker.internet.email(),
			notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
			...dataOverrides,
		} satisfies typeof tables.clientData.$inferInsert;

		return {
			/** Returns new addresses to be inserted.
			 * @remarks Explicit id overrides do not build addresses. */
			address,
			/** Represents a clientData object */
			data,
		};
	});

	return { client, history };
}

export async function seedClients(
	ctx: SeedContext,
	{
		count = { min: 8, max: 42 },
		versions = { min: 1, max: 3 },
		overrides,
	}: SeedOptions<ClientShape> & VersionOptions = {},
): Promise<ClientRecord[]> {
	const built = ctx.faker.helpers.multiple(
		(_, i) => buildClient(ctx, versions, overrideAt(overrides, i)),
		{ count },
	);

	const history = built.flatMap(b => b.history);

	const clients = await ctx.tx
		.insert(tables.clients)
		.values(built.map(b => b.client))
		.returning();

	await insertAddresses(ctx, history);

	const clientData = await ctx.tx
		.insert(tables.clientData)
		.values(history.map(v => v.data))
		.returning();

	// Versions are built oldest first, so each client lists its history in that order
	const chronological = inBuiltOrder(
		clientData,
		history.map(v => v.data),
	);

	return inBuiltOrder(
		clients,
		built.map(b => b.client),
	).map(client => ({
		...client,
		versions: chronological.filter(version => version.clientId === client.id),
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
