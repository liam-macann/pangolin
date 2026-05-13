import {
	and,
	count,
	countDistinct,
	desc,
	eq,
	getColumns,
	isNotNull,
	isNull,
	max,
	ne,
	type SQL,
	sumDistinct,
} from 'drizzle-orm';
import { getRegisteredCountries } from 'lib-address';

import { crypto, type Decrypted } from '@/lib/encrypt';
import { fetchAddressMetadata, formatAddress } from '@/lib/utils/address';
import { jsonbAgg, jsonbBuildObject, withFilter } from '@/lib/utils/drizzle';
import { withRLS } from '@/db';
import * as schema from '@/db/schema';

import { getSession } from '@/auth';

export interface ClientResult {
	id: string;
	isFavorite: boolean;
	isDeleted: boolean;
	invoiceCount: number;
	data: {
		scdId: string;
		name: string;
		email: string;
		notes: string | null;
		address: Omit<Decrypted<typeof schema.address.$inferSelect>, 'userId' | 'id'> | null;
		/** Address string formatted according to country metadata.
		 *
		 * This is included to avoid a waterfall on the client, as metadata registration is needed to format. */
		formattedAddress: string | null;
	};
}

export async function fetchClients(): Promise<ClientResult[]>;
export async function fetchClients(id: string): Promise<ClientResult>;

/** Fetch all clients for authenticated user, or a single client if `id` is provided */
export async function fetchClients(id?: string) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	try {
		const res = await withRLS(async db =>
			db.query.clients.findMany({
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
							.leftJoin(schema.invoices, eq(schema.invoices.clientDataId, schema.clientData.id))}
						)`.mapWith(Number),
				},
				where: {
					userId: { eq: session.user.id },
					// Exclude deleted clients, unless requesting a specific id
					...(id ? { id: { eq: id } } : { isDeleted: { eq: false } }),
				},
				orderBy: (c, { sql }) =>
					sql<string>`(${db
						.select({ name: schema.clientData.name })
						.from(schema.clientData)
						.where(and(eq(schema.clientData.clientId, c.id), isNull(schema.clientData.validTo)))
						.limit(1)}
				)`,
			}),
		);

		const vault = await crypto(session.user.id);
		const decrypted = await Promise.all(res.map(el => vault.decryptObject(el)));
		vault.destroy();

		const mapped: ClientResult[] = await Promise.all(
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
			if (!mapped[0]) throw new Error('Client not found.');
			return mapped[0];
		}

		return mapped;
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch clients.');
	}
}

export async function fetchClientStats(id: string) {
	return withRLS(async (db, session) => {
		/** Access all invoices for a given client that have not been voided */
		const validityFilter = db.$with('validity_filter').as(
			db
				.select({
					...getColumns(schema.invoicesWithSum),
					status: schema.invoiceStatus.status,
				})
				.from(schema.clients)
				.leftJoin(schema.clientData, eq(schema.clientData.clientId, schema.clients.id))
				.leftJoin(
					schema.invoicesWithSum,
					eq(schema.invoicesWithSum.clientDataId, schema.clientData.id),
				)
				.leftJoin(schema.invoiceStatus, eq(schema.invoiceStatus.id, schema.invoicesWithSum.id))
				.where(
					and(
						eq(schema.clients.userId, session.user.id),
						eq(schema.invoiceStatus.isVoid, false),
						eq(schema.clients.id, id),
					),
				),
		);

		// Currency may change when configuration is updated.
		// Figures are not aware of currency, hence may not be aggregated over the entire table.
		const totals = db
			.with(validityFilter)
			.select({
				netSum: withFilter(
					sumDistinct(validityFilter.netTotal).mapWith(Number),
					ne(validityFilter.status, 'refunded'),
				).as('net_sum'),
				grossSum: withFilter(
					sumDistinct(validityFilter.grossTotal).mapWith(Number),
					ne(validityFilter.status, 'refunded'),
				).as('gross_sum'),
				grossOutstanding: withFilter(
					sumDistinct(validityFilter.grossTotal).mapWith(Number),
					eq(validityFilter.status, 'unpaid'),
				).as('gross_outstanding'),

				currency: validityFilter.currency,
				maxCreatedAt: max(validityFilter.createdAt).as('max_created_at'),
			})
			.from(validityFilter)
			.groupBy(validityFilter.currency)
			.as('sum_per_currency');

		const aggTotals = db.$with('agg').as(
			db
				.select({
					totals: jsonbAgg(
						jsonbBuildObject({
							netSum: totals.netSum,
							grossSum: totals.grossSum,
							grossOutstanding: totals.grossOutstanding,
							currency: totals.currency as unknown as SQL<string>, // Assertion necessary to correct type non-nullability
							updatedAt: totals.maxCreatedAt,
						}),
						undefined,
						// Sort currency by recency of invoices
						desc(totals.maxCreatedAt),
					).as('totals'),
				})
				.from(totals),
		);

		return db
			.with(validityFilter, aggTotals)
			.select({
				/** Excludes voided invoices */
				validCount: countDistinct(validityFilter.id).as('count'),
				totals: aggTotals.totals,
			})
			.from(validityFilter)
			.leftJoin(aggTotals, isNotNull(aggTotals.totals))
			.groupBy(aggTotals.totals)
			.then(([v]) => {
				// Validity filter may have no rows
				const defaults: Omit<typeof v, 'totals'> & { totals: null } = {
					validCount: 0, // We know that validCount is 0
					totals: null, // Totals cannot be inferred without an invoice (grouped by currency)
				};

				return (v || defaults) as typeof v | typeof defaults;
			});
	});
}
