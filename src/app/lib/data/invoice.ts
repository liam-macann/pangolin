import {
	and,
	asc,
	countDistinct,
	desc,
	eq,
	getColumns,
	isNotNull,
	max,
	min,
	ne,
	type RelationsFilter,
	sql,
	sum,
} from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import { cacheLife, cacheTag } from 'next/cache';
import { notFound, unstable_rethrow } from 'next/navigation';

import { type Config, fetchConfig } from '@/lib/data';
import { crypto } from '@/lib/encrypt';
import { invoiceReference, type Prettify } from '@/lib/utils';
import { coalesce, jsonbAgg, jsonbBuildObject, withFilter } from '@/lib/utils/drizzle';
import { withRLS } from '@/db';
import { type relations } from '@/db/relations';
import * as schema from '@/db/schema';

import { type Session } from '@/auth';

import { type ClientData } from './client';
import { query } from './helpers';

export type Invoice = Awaited<ReturnType<typeof fetchInvoices>>[number];

/** A billed line item, joined with the tax rows applied to it */
export type LineItem = Prettify<
	Omit<
		typeof schema.itemsWithTax.$inferSelect,
		'id' | 'invoiceId' | 'userId' | 'configId' | 'taxRegistration' | 'order'
	> & {
		taxes: Pick<typeof schema.taxes.$inferSelect, 'name' | 'rate'>[];
	}
>;

/** Superset of {@link Invoice} with relational data */
export type DetailedInvoice = Omit<Invoice, 'clientData' | 'config'> & {
	clientData: Pick<ClientData, 'name' | 'organization' | 'address'>;
	config: Config;
	items: LineItem[];

	/** Tax contribution across all items, collapsed by tax name */
	tax: { name: string; contribution: number }[];
};

/** Fetch all invoices for authenticated user, including basic relational data */
export const fetchInvoices = (
	filter?: RelationsFilter<typeof relations.invoicesWithSum, typeof relations>,
	limit?: number,
) => query(async session => _fetchInvoices(session, filter, limit), 'Failed to fetch invoices');

async function _fetchInvoices(
	session: Session,
	filter?: RelationsFilter<typeof relations.invoicesWithSum, typeof relations>,
	limit?: number,
) {
	'use cache';
	cacheLife('hours');
	cacheTag(`invoices-${session.user.id}`);

	return withRLS(session, async tx =>
		tx.query.invoicesWithSum.findMany({
			where: {
				...filter,
				userId: { eq: session.user.id },
			},
			columns: {
				clientDataId: false,
				configId: false,
				userId: false,

				// Included with config data
				taxRegistration: false,
				currency: false,
			},
			with: {
				status: { columns: { id: false, userId: false } },
				clientData: { columns: { name: true, organization: true, clientId: true } },
				config: {
					columns: {
						timezone: true,
						currency: true,
						numberingScheme: true,
					},
				},
			},
			orderBy: { index: 'desc' },
			limit,
		}),
	).then(res =>
		res.map(inv => ({
			...inv,
			reference: invoiceReference(inv, inv.config.numberingScheme),
		})),
	);
}

/** Fetch all invoices for a given client. Accepts logical client ID, not SCD ID. */
export const fetchInvoicesForClient = (clientId: string, limit?: number) =>
	fetchInvoices({ clientData: { client: { id: { eq: clientId } } } }, limit);

/** Join relational (incl. item) details with a single invoice record for authenticated user */
export async function fetchInvoice(id: string): Promise<DetailedInvoice> {
	try {
		return await withRLS(async (db, session) => {
			// Get all active taxes, and calculate sum for display in the invoice subtotals
			// Executed as CTE to collapse tax rows that share the same name (eg. GST(10%) and GST(5%) would share one sum)
			const taxContribution = db.$with('tax_calc').as(
				db
					.select({
						contribution:
							sql`${withFilter(sum(schema.invoiceItems.netAmount), eq(schema.itemTaxes.taxId, schema.taxes.id))} * ${schema.taxes.rate} * ${schema.config.taxRegistration}::int`
								.mapWith(Number)
								.as('contribution'),

						taxId: schema.taxes.id,
						configId: schema.config.id,
						order: schema.configTaxes.order,
						name: schema.taxes.name,
						rate: schema.taxes.rate,
					})
					.from(schema.invoices)
					.where(eq(schema.invoices.id, id))
					.innerJoin(schema.config, eq(schema.invoices.configId, schema.config.id))
					.innerJoin(schema.configTaxes, eq(schema.configTaxes.configId, schema.config.id))
					.innerJoin(schema.taxes, eq(schema.taxes.id, schema.configTaxes.taxId))
					.leftJoin(schema.invoiceItems, eq(schema.invoiceItems.invoiceId, schema.invoices.id))
					.leftJoin(schema.itemTaxes, eq(schema.itemTaxes.itemId, schema.invoiceItems.id))
					.groupBy(schema.config.id, schema.taxes.id, schema.configTaxes.order)
					.orderBy(schema.configTaxes.order),
			);

			const res = await db.query.invoicesWithSum.findFirst({
				where: { userId: { eq: session.user.id }, id: { eq: id } },
				columns: {
					clientDataId: false,
					userId: false,

					// Included with config data
					taxRegistration: false,
					currency: false,
				},
				with: {
					status: { columns: { id: false, userId: false } },
					clientData: {
						columns: { name: true, organization: true },
						with: { address: true },
					},
					items: {
						columns: {
							id: false,
							invoiceId: false,
							userId: false,
							configId: false,
							taxRegistration: false,
							order: false,
						},
						with: { taxes: { columns: { name: true, rate: true } } },
						orderBy: { order: 'asc' },
					},
				},
				orderBy: { index: 'desc' },
			});

			// Collapse tax rows that share the same name
			const tax = await db
				.with(taxContribution)
				.select({
					name: taxContribution.name,
					contribution: coalesce(sum(taxContribution.contribution), 0).mapWith(Number),
				})
				.from(taxContribution)
				.groupBy(taxContribution.name)
				.orderBy(asc(min(taxContribution.order)));

			if (!res) notFound();

			const { configId, ...invoiceRes } = res;
			const config = await fetchConfig(configId);

			const vault = await crypto(session.user.id);
			const inv: DetailedInvoice = {
				...invoiceRes,
				reference: invoiceReference(res, config.numberingScheme),
				config,
				clientData: await vault.decryptObject(res.clientData),
				tax,
			};
			vault.destroy();

			return inv;
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoice');
	}
}

const defaultInvoiceFilter = new QueryBuilder()
	.$with('stats_filter')
	.as(new QueryBuilder().select().from(schema.invoicesWithSum));

/** Fetch all invoices for authenticated user, including basic relational data */
export const fetchStats = (filter: typeof defaultInvoiceFilter = defaultInvoiceFilter) =>
	query(async session => _fetchStats(session, filter), 'Failed to fetch invoice statistics');

/** Outstanding gross totals per currency across all user invoices (excludes voided invoices) */
async function _fetchStats(
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
				.where(and(eq(filter.userId, session.user.id), eq(schema.invoiceStatus.isVoid, false))),
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
				)
					.mapWith(Number)
					.as('net_sum'),

				grossSum: coalesce(
					withFilter(
						sum(validityFilter.grossTotal),
						// Exclude refunded invoices
						ne(validityFilter.status, 'refunded'),
					),
					0,
				)
					.mapWith(Number)
					.as('gross_sum'),

				grossOutstanding: coalesce(
					withFilter(
						sum(validityFilter.grossTotal),
						// Include only unpaid invoices
						eq(validityFilter.status, 'unpaid'),
					),
					0,
				)
					.mapWith(Number)
					.as('gross_outstanding'),

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
