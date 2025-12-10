import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	getColumns,
	isNotNull,
	isNull,
	max,
	min,
	ne,
	type RelationsFilter,
	type SQL,
	sql,
	sumDistinct,
} from 'drizzle-orm';
import { headers } from 'next/headers';
import { getSession } from '@/auth';
import { db } from '@/db';
import type { relations } from '@/db/relations';
import {
	clientData,
	clients,
	config as configSchema,
	configTaxes,
	invoiceItems,
	invoices,
	invoicesWithSum,
	itemTaxes,
	taxes as taxesSchema,
} from '@/db/schema';
import { crypto } from '@/lib/encrypt';
import { formatCurrency, formatDateToLocal, invoiceReference } from '@/lib/utils';
import { jsonbAgg, jsonbBuildObject, withFilter } from '@/lib/utils/drizzle';

/** Fetch all invoices for authenticated user, including basic relational data */
export async function fetchInvoices(
	filter?: RelationsFilter<typeof relations.invoicesWithSum, typeof relations>,
	limit?: number,
) {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	try {
		// Get current config to format historical invoices
		const [currentConfig, result] = await Promise.all([
			getUserConfig(),
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
					clientData: true,
					config: {
						columns: {
							validFrom: false,
							validTo: false,
							id: false,
							userId: false,
							paymentDetails: false,
						},
					},
				},
				orderBy: { index: 'desc' },
				limit,
			}),
		]);

		return result.map(res => ({
			...res,
			/** Values formatted according to current locale */
			formatted: {
				grossTotal: formatCurrency(res.grossTotal, res.config.currency, currentConfig.locale),
				issuedAt: formatDateToLocal(res.issuedAt, false, currentConfig.locale),
				reference: invoiceReference(res, res.config.numberingScheme),
			},
		}));
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices');
	}
}

/** Fetch all invoices for a given client. Accepts logical client ID, not SCD ID. */
export const fetchInvoicesForClient = (clientId: string, limit?: number) =>
	fetchInvoices({ clientData: { client: { id: { eq: clientId } } } }, limit);

/** Return type of `fetchInvoice()` */
export type DetailedInvoice = Awaited<ReturnType<typeof fetchInvoice>>;

/**
 * Join relational (incl. item) details with a single invoice record for authenticated user
 * @returns `Promise<InvoiceWithRelations>` */
export async function fetchInvoice(id: string) {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	// Get all active taxes, and calculate sum for display in the invoice subtotals
	// Executed as CTE to collapse tax rows that share the same name (eg. GST(10%) and GST(5%) would share one sum)
	const taxContribution = db.$with('tax_calc').as(
		db
			.select({
				contribution:
					sql<number>`${withFilter(sumDistinct(invoiceItems.netAmount), eq(itemTaxes.taxId, taxesSchema.id))} * ${taxesSchema.rate} * ${configSchema.taxRegistration}::int`
						.mapWith(Number)
						.as('contribution'),

				taxId: taxesSchema.id,
				configId: configSchema.id,
				order: configTaxes.order,
				name: taxesSchema.name,
				rate: taxesSchema.rate,
			})
			.from(invoices)
			.where(eq(invoices.id, id))
			.innerJoin(configSchema, eq(invoices.configId, configSchema.id))
			.innerJoin(configTaxes, eq(configTaxes.configId, configSchema.id))
			.leftJoin(taxesSchema, eq(taxesSchema.id, configTaxes.taxId))
			.leftJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
			.leftJoin(itemTaxes, eq(itemTaxes.itemId, invoiceItems.id))
			.groupBy(configSchema.id, taxesSchema.id, configTaxes.order)
			.orderBy(configTaxes.order),
	);

	try {
		const [res, tax] = await Promise.all([
			db.query.invoicesWithSum.findFirst({
				where: { userId: { eq: session.user.id }, id: { eq: id } },
				columns: {
					clientDataId: false,
					configId: false,
					userId: false,
				},
				with: {
					clientData: true,
					config: {
						columns: {
							validFrom: false,
							validTo: false,
							id: false,
							userId: false,
						},
					},
					items: { with: { taxes: true } },
				},
				orderBy: { index: 'desc' },
			}),

			// Collapse tax rows that share the same name
			db
				.with(taxContribution)
				.select({
					name: taxContribution.name,
					contribution: sumDistinct(taxContribution.contribution).mapWith(Number),
				})
				.from(taxContribution)
				.groupBy(taxContribution.name)
				.orderBy(asc(min(taxContribution.order))),
		]);

		if (!res) throw new Error('Invoice not found');

		const vault = await crypto(session.user.id);

		const inv = {
			...res,
			config: {
				...res.config,
				paymentDetails:
					res.config.paymentDetails && (await vault.decrypt(...res.config.paymentDetails)),
			},
			formatted: { reference: invoiceReference(res, res.config.numberingScheme) },
		};

		vault.destroy();

		return { ...inv, tax };
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoice');
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

export async function getUser() {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	const user = await db.query.users.findFirst({ where: { id: session.user.id } });
	if (!user) throw new Error('User not found');

	return user;
}

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
		throw new Error('Failed to fetch invoices.');
	}
}

/** Gets the active configuration for the authenticated user */
export async function getUserConfig() {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	try {
		const vault = await crypto(session.user.id);

		const res = await db.query.config
			.findFirst({
				where: {
					userId: session.user.id,
					validTo: undefined,
				},
				with: {
					user: true,
					taxes: { orderBy: { id: 'asc' } },
				},
				orderBy: { validFrom: 'desc' },
			})
			.then(
				async res =>
					res && {
						...res,
						paymentDetails:
							res.paymentDetails &&
							(await vault.decrypt(...res.paymentDetails)).map(v => {
								const [label, value] = v.split(': ');
								return { label, value };
							}),
					},
			);

		vault.destroy();

		// If user has no current config
		if (!res) throw new Error('User has no current valid config.');

		return res;
	} catch (error) {
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	}
}
