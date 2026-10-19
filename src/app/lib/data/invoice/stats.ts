import {
	and,
	countDistinct,
	desc,
	eq,
	getColumns,
	isNotNull,
	isNull,
	max,
	ne,
	type SQL,
	sql,
	sum,
} from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';

import { coalesce, jsonbAgg, jsonbBuildObject, withFilter } from '@/lib/utils/drizzle';
import { type NumericString } from '@/lib/utils/numeric';
import { withRLS } from '@/db';
import * as schema from '@/db/schema';

import { type Session } from '@/auth';

import { query } from './../helpers';

const toNumericString = (value: SQL.Aliased | SQL) => sql<NumericString>`${value}::numeric::text`;

/** Fetch all invoices for authenticated user, including basic relational data */

export const fetchStats = (filter: typeof defaultInvoiceFilter = defaultInvoiceFilter) =>
	query(async session => _fetchStats(session, filter), 'Failed to fetch invoice statistics');

export const defaultInvoiceFilter = new QueryBuilder()
	.$with('stats_filter')
	.as(new QueryBuilder().select().from(schema.documentsWithSum));

/** Outstanding gross totals per currency across all user invoices (excludes voided invoices) */
export async function _fetchStats(
	session: Session,
	/** Scope the invoice statistics to a subset */
	filter: typeof defaultInvoiceFilter = defaultInvoiceFilter,
) {
	return withRLS(session, async db => {
		/** Access all invoices that have not been voided */
		const validityFilter = db.$with('validity_filter').as(
			db
				.with(filter)
				.select({
					...getColumns(filter),
					status: schema.invoiceStatus.status,
				})
				.from(filter)
				.leftJoin(schema.invoiceStatus, eq(schema.invoiceStatus.id, filter.id))
				.where(and(eq(filter.userId, session.user.id), isNull(schema.invoiceStatus.voidedAt))),
		);

		// Currency may change when configuration is updated.
		// Figures are not aware of currency, hence may not be aggregated over the entire table.
		const totals = db
			.with(validityFilter)
			.select({
				netSum: coalesce(
					withFilter(
						sum(validityFilter.netTotal),
						// Exclude refunded invoices
						ne(validityFilter.status, 'refunded'),
					),
					0,
				).as('net_sum'),

				grossSum: coalesce(
					withFilter(
						sum(validityFilter.grossTotal),
						// Exclude refunded invoices
						ne(validityFilter.status, 'refunded'),
					),
					0,
				).as('gross_sum'),

				grossOutstanding: coalesce(
					withFilter(
						sum(validityFilter.grossTotal),
						// Include only unpaid invoices
						eq(validityFilter.status, 'unpaid'),
					),
					0,
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
							netSum: toNumericString(totals.netSum),
							grossSum: toNumericString(totals.grossSum),
							grossOutstanding: toNumericString(totals.grossOutstanding),
							currency: totals.currency,
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
