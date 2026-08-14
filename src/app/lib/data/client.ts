import { and, count, eq, getColumns, isNull, type SQL } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import { getRegisteredCountries } from 'lib-address';
import { notFound, unstable_rethrow } from 'next/navigation';

import { fetchStats } from '@/lib/data/invoice/stats';
import { crypto, type Decrypted } from '@/lib/encrypt';
import { fetchAddressMetadata, formatAddress } from '@/lib/utils/address';
import { coalesce } from '@/lib/utils/drizzle';
import { withRLS } from '@/db';
import * as schema from '@/db/schema';

export interface Client {
	id: string;
	isFavorite: boolean;
	isDeleted: boolean;
	invoiceCount: number;
	data: ClientData;
}

export interface ClientData {
	name: string | null;
	organization: string | null;
	scdId: string;
	email: string;
	notes: string | null;
	address: Omit<Decrypted<typeof schema.address.$inferSelect>, 'userId' | 'id'> | null;
	/** Address string formatted according to country metadata.
	 *
	 * This is included to avoid a waterfall on the client, as metadata registration is needed to format. */
	formattedAddress: string | null;
}

export async function fetchClients(): Promise<Client[]>;
export async function fetchClients(id: string): Promise<Client>;

/** Fetch all clients for authenticated user, or a single client if `id` is provided */
export async function fetchClients(id?: string) {
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
					...(id ? { id: { eq: id } } : { isDeleted: { eq: false } }),
				},
				orderBy: (c, { sql }) =>
					sql<string>`(${db
						.select({ name: coalesce(schema.clientData.organization, schema.clientData.name) })
						.from(schema.clientData)
						.where(and(eq(schema.clientData.clientId, c.id), isNull(schema.clientData.validTo)))
						.limit(1)}
				)`,
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

			if (id) {
				if (!mapped[0]) notFound();
				return mapped[0];
			}

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
