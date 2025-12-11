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
import { headers } from 'next/headers';
import { getSession } from '@/auth';
import { db } from '@/db';
import { clientData, clients, invoices, invoicesWithSum } from '@/db/schema';
import { jsonbAgg, jsonbBuildObject, withFilter } from '@/lib/utils/drizzle';

export interface ClientResult {
	id: string;
	isFavorite: boolean;
	isDeleted: boolean;
	invoiceCount: number;
	data: {
		scdId: string;
		name: string;
		email: string;
	};
}

export async function fetchClients(): Promise<ClientResult[]>;
export async function fetchClients(id: string): Promise<ClientResult>;

/** Fetch all clients for authenticated user, or a single client if `id` is provided */
export async function fetchClients(id?: string) {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	try {
		const invoiceCounts = db.$with('invoice_counts').as(
			db
				.select({
					clientId: clients.id,
					/** Includes voided invoices */
					count: count(invoices.id).as('count'),
				})
				.from(clients)
				.leftJoin(clientData, eq(clientData.clientId, clients.id))
				.leftJoin(invoices, eq(invoices.clientDataId, clientData.id))
				.groupBy(clients.id),
		);

		return await db
			.with(invoiceCounts)
			.select({
				id: clients.id,
				isFavorite: clients.isFavorite,
				isDeleted: clients.isDeleted,
				invoiceCount: invoiceCounts.count,
				data: jsonbBuildObject({
					scdId: clientData.id,
					name: clientData.name,
					email: clientData.email,
				}),
			})
			.from(clients)
			.innerJoin(clientData, and(eq(clients.id, clientData.clientId), isNull(clientData.validTo)))
			.leftJoin(invoiceCounts, eq(clients.id, invoiceCounts.clientId))
			.where(
				and(
					eq(clients.userId, session.user.id),
					id ? eq(clients.id, id) : eq(clients.isDeleted, false),
				),
			)
			.groupBy(clients.id, clientData.id, invoiceCounts.count)
			.orderBy(clientData.name)
			.then(res => (id ? res[0] : res));
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch clients.');
	}
}

export async function fetchClientStats(id: string) {
	const session = await getSession({ headers: await headers() });
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
