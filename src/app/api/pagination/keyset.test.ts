import { and, eq, getTableName, isNull, sql } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import { describe, expect, test } from 'vitest';

import { defineKeyset } from '@/api/pagination';
import { encode } from '@/api/pagination/cursor';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import { asUser } from '@/test/session';

const qb = new QueryBuilder();

const organization = (client: typeof tables.clients) =>
	sql<string | null>`${qb
		.select({ organization: tables.clientData.organization })
		.from(tables.clientData)
		.where(and(eq(tables.clientData.clientId, client.id), isNull(tables.clientData.validTo)))
		.limit(1)}`;

const keyset = defineKeyset(tables.clients, {
	isFavorite: client => client.isFavorite,
	organization,
	combination: [client => client.isFavorite, organization],
});

/** Traverse one-row pages of active clients in the requested order, returning all stored rows. */
const traverse = async (
	sort: Parameters<typeof keyset.page>[0]['sort'],
	cursor?: string,
): Promise<string[]> => {
	const page = keyset.page({ cursor, limit: 1, sort });
	const rows = await withRLS((tx, session) =>
		tx.query.clients.findMany({
			columns: { id: true },
			extras: page.extras,
			where: page.where({ isDeleted: { eq: false }, userId: { eq: session.user.id } }),
			orderBy: page.orderBy,
			limit: page.limit,
		}),
	);

	const { data, meta } = page.result(rows);
	expect(data).toHaveLength(1);
	const ids = data.map(client => client.id);
	return meta.nextCursor ? [...ids, ...(await traverse(sort, meta.nextCursor))] : ids;
};

describe('defineKeyset()', () => {
	test('Trims rows and strips sort values, minting a cursor only when more rows follow', () => {
		const page = keyset.page({ cursor: undefined, limit: 1, sort: {} });
		const rows = [
			{ id: 'client-a', sortValues: ['client-a'] },
			{ id: 'client-b', sortValues: ['client-b'] },
		];

		expect(page.result(rows)).toEqual({
			data: [{ id: 'client-a' }],
			meta: {
				limit: 1,
				nextCursor: encode(
					{ sort: {}, values: ['client-a'] },
					{ table: getTableName(tables.clients) },
				),
			},
		});
		expect(page.result(rows.slice(1))).toEqual({
			data: [{ id: 'client-b' }],
			meta: { limit: 1, nextCursor: null },
		});
	});

	test('Throws a non-cursor error when the fetcher did not select the sort values', () => {
		const page = keyset.page({ cursor: undefined, limit: 1, sort: {} });
		expect(() => page.result([{ id: 'client-a' }, { id: 'client-b' }])).toThrow(
			'Fetched rows are missing extra columns',
		);
	});

	asUser('Falls back to ascending identifiers when no sort is requested', async ({ seed }) => {
		const clients = await seed.clients({ count: 3, overrides: { isDeleted: false } });
		expect(await traverse({})).toEqual(clients.map(client => client.id).sort());
	});

	asUser('Orders ties on a field of several expressions by each later one', async ({ seed }) => {
		const [zeta, acme, starredZeta, starredAcme] = await seed.clients({
			versions: 1,
			overrides: [
				{ isDeleted: false, isFavorite: false, data: { organization: 'Zeta Corp' } },
				{ isDeleted: false, isFavorite: false, data: { organization: 'Acme Corp' } },
				{ isDeleted: false, isFavorite: true, data: { organization: 'Zeta Corp' } },
				{ isDeleted: false, isFavorite: true, data: { organization: 'Acme Corp' } },
			],
		});

		const ascending = [acme.id, zeta.id, starredAcme.id, starredZeta.id];
		expect(await traverse({ combination: 'asc' })).toEqual(ascending);
		expect(await traverse({ combination: 'desc' })).toEqual(ascending.toReversed());
	});

	asUser.for([
		{ favorite: 'asc', organization: 'asc' },
		{ favorite: 'asc', organization: 'desc' },
		{ favorite: 'desc', organization: 'asc' },
		{ favorite: 'desc', organization: 'desc' },
	] as const)(
		'Pages through favorite $favorite and organization $organization with null ties',
		async ({ favorite, organization }, { seed }) => {
			const [nullA, nullB, acme, zeta, starred] = await seed.clients({
				versions: 1,
				overrides: [
					{ isDeleted: false, isFavorite: false, data: { organization: null } },
					{ isDeleted: false, isFavorite: false, data: { organization: null } },
					{ isDeleted: false, isFavorite: false, data: { organization: 'Acme Corp' } },
					{ isDeleted: false, isFavorite: false, data: { organization: 'Zeta Corp' } },
					{ isDeleted: false, isFavorite: true, data: { organization: 'Acme Corp' } },
					{ isDeleted: true, isFavorite: true, data: { organization: 'Acme Corp' } },
				],
			});

			const unstarred = [acme.id, zeta.id, ...[nullA.id, nullB.id].sort()];
			const ordered = organization === 'asc' ? unstarred : unstarred.toReversed();
			expect(await traverse({ isFavorite: favorite, organization })).toEqual(
				favorite === 'asc' ? [...ordered, starred.id] : [starred.id, ...ordered],
			);
		},
	);
});
