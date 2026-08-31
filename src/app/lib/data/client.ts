import { and, count, eq, getColumns, isNull, type RelationsFilter, type SQL } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import { getRegisteredCountries } from 'lib-address';
import { notFound, unstable_rethrow } from 'next/navigation';

import { type Client } from '@/api/dto/client';
import { fetchStats } from '@/lib/data/invoice/stats';
import { crypto } from '@/lib/encrypt';
import { fetchAddressMetadata, formatAddress } from '@/lib/utils/address';
import { coalesce } from '@/lib/utils/drizzle';
import { withRLS } from '@/db';
import { type relations } from '@/db/relations';
import * as schema from '@/db/schema';

export type ClientData = Client['data'];

export async function fetchClient(id: string) {
	const clients = await fetchClients(
		{ id: { eq: id }, isDeleted: { eq: undefined } },
		{ limit: 1 },
	);
	if (!clients[0]) notFound();
	return clients[0];
}

/** Fetch all clients for authenticated user, or a single client if `id` is provided.
 * @remarks Define `{ limit, offset }` to paginate the list form */
export async function fetchClients(
	filter?: RelationsFilter<typeof relations.clients, typeof relations>,
	opts?: { limit?: number; offset?: number },
) {
	const { limit, offset } = opts ?? {};

	try {
		return await withRLS(async (db, session) => {
			const res = await db.query.clients.findMany({
				columns: {
					id: true,
					isFavorite: true,
					isDeleted: true,
				},
				with: {
					data: {
						columns: { id: false },
						with: { address: { columns: { id: false, userId: false } } },
						extras: { scdId: data => data.id.getSQL() as SQL<string> },
						where: { validTo: { isNull: true } },
						limit: 1,
					},
				},
				extras: {
					/** Includes voided invoices */
					invoiceCount: (c, { sql }) =>
						sql`(${db
							.select({ count: count(schema.invoices.id) })
							.from(schema.clientData)
							.where(eq(schema.clientData.clientId, c.id))
							.leftJoin(schema.documents, eq(schema.documents.clientDataId, schema.clientData.id))
							.leftJoin(schema.invoices, eq(schema.invoices.id, schema.documents.id))}
						)`.mapWith(Number),
				},
				where: {
					userId: { eq: session.user.id },
					// Exclude deleted clients, unless requesting a specific id
					isDeleted: { eq: false },
					...(filter !== undefined ? filter : {}),
				},
				orderBy: (c, { sql }) =>
					sql<string>`(${db
						.select({ name: coalesce(schema.clientData.organization, schema.clientData.name) })
						.from(schema.clientData)
						.where(and(eq(schema.clientData.clientId, c.id), isNull(schema.clientData.validTo)))
						.limit(1)}
				)`,
				limit,
				offset,
			});

			const vault = await crypto(session.user.id);
			const decrypted = await Promise.all(res.map(el => vault.decryptObject(el)));
			vault.destroy();

			const mapped: Client[] = await Promise.all(
				decrypted.map(async client => {
					const clientData = client.data?.[0];

					const registered = getRegisteredCountries().map(c => c.value);

					// At build, all countries should be registered. During dev, fetch metadata for any non-registered country.
					if (clientData?.address?.country && !registered.includes(clientData.address.country)) {
						await fetchAddressMetadata(clientData.address.country);
					}

					return {
						...client,
						data: {
							...clientData,
							formattedAddress: formatAddress(clientData?.address),
						},
					};
				}),
			);

			return mapped;
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error('Database Error:', error);
		throw new Error('Failed to fetch clients.');
	}
}

/** Count non-deleted clients for the authenticated user */
export async function countClients(): Promise<number> {
	try {
		return await withRLS(async (db, session) => {
			const [row] = await db
				.select({ count: count() })
				.from(schema.clients)
				.where(
					and(eq(schema.clients.userId, session.user.id), eq(schema.clients.isDeleted, false)),
				);

			return row?.count ?? 0;
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error('Database Error:', error);
		throw new Error('Failed to count clients.');
	}
}

export async function fetchClientStats(id: string) {
	const qb = new QueryBuilder();

	const clientFilter = qb
		.$with('stats_filter')
		.as(
			qb
				.select(getColumns(schema.documentsWithSum))
				.from(schema.clients)
				.leftJoin(schema.clientData, eq(schema.clientData.clientId, schema.clients.id))
				.innerJoin(
					schema.documentsWithSum,
					eq(schema.documentsWithSum.clientDataId, schema.clientData.id),
				)
				.where(eq(schema.clients.id, id)),
		);

	return fetchStats(clientFilter);
}
