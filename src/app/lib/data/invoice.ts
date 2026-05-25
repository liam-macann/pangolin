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
	sumDistinct,
} from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import { notFound, unstable_rethrow } from 'next/navigation';

import { crypto } from '@/lib/encrypt';
import { invoiceReference } from '@/lib/utils';
import { jsonbAgg, jsonbBuildObject, withFilter } from '@/lib/utils/drizzle';
import { withRLS } from '@/db';
import { type relations } from '@/db/relations';
import * as schema from '@/db/schema';

/** Fetch all invoices for authenticated user, including basic relational data */

export async function fetchInvoices(
	filter?: RelationsFilter<typeof relations.invoicesWithSum, typeof relations>,
	limit?: number,
) {
	try {
		// Get current config to format historical invoices
		return await withRLS(async (db, session) =>
			db.query.invoicesWithSum.findMany({
				where: {
					...filter,
					userId: { eq: session.user.id },
				},
				columns: {
					clientDataId: false,
					configId: false,
					userId: false,
				},
				with: {
					status: { columns: { id: false } },
					clientData: { columns: { name: true, clientId: true } },
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
	} catch (error) {
		unstable_rethrow(error);
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices');
	}
}

/** Fetch all invoices for a given client. Accepts logical client ID, not SCD ID. */
export const fetchInvoicesForClient = (clientId: string, limit?: number) =>
	fetchInvoices({ clientData: { client: { id: { eq: clientId } } } }, limit);

/** Join relational (incl. item) details with a single invoice record for authenticated user */
export async function fetchInvoice(id: string) {
	try {
		return await withRLS(async (db, session) => {
			// Get all active taxes, and calculate sum for display in the invoice subtotals
			// Executed as CTE to collapse tax rows that share the same name (eg. GST(10%) and GST(5%) would share one sum)
			const taxContribution = db.$with('tax_calc').as(
				db
					.select({
						contribution:
							sql`${withFilter(sumDistinct(schema.invoiceItems.netAmount), eq(schema.itemTaxes.taxId, schema.taxes.id))} * ${schema.taxes.rate} * ${schema.config.taxRegistration}::int`
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
					configId: false,
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
					config: {
						columns: {
							validFrom: false,
							validTo: false,
							id: false,
							userId: false,
							addressId: false,
						},
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
						with: { taxes: { columns: { userId: false, id: false } } },
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
					contribution: sumDistinct(taxContribution.contribution).mapWith(Number),
				})
				.from(taxContribution)
				.groupBy(taxContribution.name)
				.orderBy(asc(min(taxContribution.order)));

			if (!res) notFound();

			const vault = await crypto(session.user.id);
			const inv = {
				...res,
				reference: invoiceReference(res, res.config.numberingScheme),
				config: await vault.decryptObject(res.config),
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

/** Outstanding gross totals per currency across all user invoices (excludes voided invoices) */
export async function fetchStats(
	/** Scope the invoice statistics to a subset */
	filter: typeof defaultInvoiceFilter = defaultInvoiceFilter,
) {
	return withRLS(async (db, session) => {
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
