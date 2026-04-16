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

import { crypto, type Decrypted } from '@/lib/encrypt';
import { jsonbAgg, jsonbBuildObject, withFilter } from '@/lib/utils/drizzle';
import { db } from '@/db';
import { type address, clientData, clients, invoices, invoicesWithSum } from '@/db/schema';

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
		address: Omit<Decrypted<typeof address.$inferSelect>, 'userId' | 'id'> | null;
	};
}

export async function fetchClients(): Promise<ClientResult[]>;
export async function fetchClients(id: string): Promise<ClientResult>;

/** Fetch all clients for authenticated user, or a single client if `id` is provided */
export async function fetchClients(id?: string) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	try {
		const res = await db.query.clients
			.findMany({
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
						sql<number>`(${db
							.select({ count: count(invoices.id) })
							.from(clientData)
							.where(eq(clientData.clientId, c.id))
							.leftJoin(invoices, eq(invoices.clientDataId, clientData.id))}
						)`,
				},
				where: {
					userId: { eq: session.user.id },
					// Exclude deleted clients, unless requesting a specific id
					...(id ? { id: { eq: id } } : { isDeleted: { eq: false } }),
				},

				orderBy: (c, { sql }) =>
					sql<string>`(${db
						.select({ name: clientData.name })
						.from(clientData)
						.where(and(eq(clientData.clientId, c.id), isNull(clientData.validTo)))
						.limit(1)}
					)`,
			})
			.then(res => res.map(client => ({ ...client, data: client.data?.[0] })));

		const vault = await crypto(session.user.id);
		const decrypted: ClientResult[] = await Promise.all(res.map(el => vault.decryptObject(el)));
		vault.destroy();

		return id ? decrypted[0] : decrypted;
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch clients.');
	}
}

export async function fetchClientStats(id: string) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	/** Access all invoices for a given client that have not been voided */
	const validityFilter = db
		.select({ ...getColumns(invoicesWithSum) })
		.from(clients)
		.leftJoin(clientData, eq(clientData.clientId, clients.id))
		.leftJoin(invoicesWithSum, eq(invoicesWithSum.clientDataId, clientData.id))
		.where(
			and(
				eq(clients.userId, session.user.id),
				eq(invoicesWithSum.isVoid, false),
				eq(clients.id, id),
			),
		)
		.as('validity_filter');

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
}
