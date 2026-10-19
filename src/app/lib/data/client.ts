import { and, count, EmptyFilter, eq, getColumns, isNull, type SQL } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import { getRegisteredCountries } from 'lib-address';
import { notFound, unstable_rethrow } from 'next/navigation';

import { type Client } from '@/api/dto/client';
import { type FetchOptions } from '@/lib/data/helpers';
import { fetchStats } from '@/lib/data/invoice/stats';
import { withVault } from '@/lib/encrypt';
import { fetchAddressMetadata, formatAddress } from '@/lib/utils/address';
import { coalesce } from '@/lib/utils/drizzle';
import { withRLS } from '@/db';
import { type relations } from '@/db/relations';
import * as schema from '@/db/schema';

export type ClientData = Client['data'];

/** Fetch one client by id, including soft-deleted clients */
export async function fetchClient(id: string): Promise<Client> {
	const [client] = await fetchClients({
		where: { id: { eq: id }, isDeleted: { eq: EmptyFilter } },
		limit: 1,
	});
	if (!client) notFound();
	return client;
}

/** Fetch a list of clients for the authenticated user */
export async function fetchClients(
	opts: FetchOptions<typeof relations.clients>,
): Promise<Client[]> {
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
						columns: { name: true, organization: true, email: true, notes: true },
						with: { address: { columns: { id: false, userId: false } } },
						extras: { scdId: data => data.id.getSQL() as SQL<string> },
						where: { validTo: { isNull: true } },
						limit: 1,
					},
				},
				extras: {
					...opts.extras,
					/** Includes voided invoices */
					invoiceCount: (client, { sql }) =>
						sql`(${db
							.select({ count: count(schema.invoices.id) })
							.from(schema.clientData)
							.where(eq(schema.clientData.clientId, client.id))
							.leftJoin(schema.documents, eq(schema.documents.clientDataId, schema.clientData.id))
							.leftJoin(schema.invoices, eq(schema.invoices.id, schema.documents.id))}
						)`.mapWith(Number),
				},
				where: {
					// Exclude deleted clients by default
					isDeleted: { eq: false },
					...(opts.where ?? {}),
					userId: { eq: session.user.id },
				},
				// Caller-supplied order replaces the default, so it must end on a unique key of its own
				orderBy:
					opts.orderBy ??
					((client, { sql }) =>
						sql<string>`(${db
							.select({ name: coalesce(schema.clientData.organization, schema.clientData.name) })
							.from(schema.clientData)
							.where(
								and(eq(schema.clientData.clientId, client.id), isNull(schema.clientData.validTo)),
							)
							.limit(1)}
    				)`),
				limit: opts.limit,
			});

			const decrypted = await withVault(vault => Promise.all(res.map(el => vault.decryptDeep(el))));

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
