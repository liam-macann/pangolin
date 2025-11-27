import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	getTableColumns,
	getViewSelectedFields,
	isNotNull,
	isNull,
	max,
	ne,
	type SQL,
	sql,
	sumDistinct,
} from 'drizzle-orm';
import type { PgSelectBase } from 'drizzle-orm/pg-core';
import { auth } from '@/auth';
import { db } from '@/db';
import {
	clientData,
	clients,
	config as configSchema,
	invoiceItems,
	invoices,
	invoicesWithSum,
	itemsWithTax,
	itemTaxes,
	taxes as taxesSchema,
	users,
} from '@/db/schema';
import { formatCurrency, formatDateToLocal, invoiceReference, omit } from '@/lib/utils';
import { jsonbAgg, jsonbBuildObject, withFilter } from '@/lib/utils/drizzle';

/** Builder to return a single, aggregated query for invoices.
 *
 * @remarks Can be accessed and narrowed with `.$dynamic()` */
function invoiceQuery<Detailed extends boolean>(
	/** Detailed access required to print an entire invoice */
	detailed?: Detailed,
	tx: ReturnType<typeof db.with> | typeof db = db,
) {
	// First-level aggregation: items + taxes
	const itemWithTaxes = tx
		.select({
			id: itemsWithTax.id,
			invoiceId: itemsWithTax.invoiceId,
			item: jsonbBuildObject({
				id: itemsWithTax.id,
				label: itemsWithTax.label,
				note: itemsWithTax.note,
				quantity: itemsWithTax.quantity,
				unit: itemsWithTax.unit,
				unitCost: itemsWithTax.unitCost,
				netAmount: itemsWithTax.netAmount,
				order: itemsWithTax.order,
				taxes: jsonbAgg(jsonbBuildObject(getTableColumns(taxesSchema)), isNotNull(taxesSchema.id)),
			}).as('item'),
		})
		.from(itemsWithTax)
		.leftJoin(itemTaxes, eq(itemsWithTax.id, itemTaxes.itemId))
		.leftJoin(taxesSchema, eq(itemTaxes.taxId, taxesSchema.id))
		.groupBy(...Object.values(getViewSelectedFields(itemsWithTax)))
		.as('item_with_taxes');

	// Second-level aggregation: invoice-level aggregation of items
	const itemsAggDetailed = tx
		.select({
			invoiceId: itemWithTaxes.invoiceId,
			items: jsonbAgg(itemWithTaxes.item).as('invoice_items'),
		})
		.from(itemWithTaxes)
		.groupBy(itemWithTaxes.invoiceId)
		.as('items_agg_detailed');

	const baseSelect = {
		...getViewSelectedFields(invoicesWithSum),

		client: getTableColumns(clientData),
		config: omit(getTableColumns(configSchema), ['validFrom', 'validTo', 'id', 'userId']),
	} as const;

	const detailedSelect = {
		...baseSelect,
		items: itemsAggDetailed.items,
	};

	const query = tx
		.select(detailed ? detailedSelect : baseSelect)
		.from(invoicesWithSum) as PgSelectBase<
		'invoice_with_sum',
		Detailed extends true ? typeof detailedSelect : typeof baseSelect,
		'partial'
	>;

	return query
		.where(eq(invoicesWithSum.userId, sql.placeholder('userId')))
		.innerJoin(clientData, eq(invoicesWithSum.clientData, clientData.id))
		.innerJoin(configSchema, eq(invoicesWithSum.config, configSchema.id))
		.leftJoin(itemsAggDetailed, eq(invoicesWithSum.id, itemsAggDetailed.invoiceId))
		.orderBy(desc(invoicesWithSum.index));
}

/** Fetch all invoices for authenticated user, including basic relational data */
export async function fetchInvoices() {
	const session = await auth();

	try {
		// Get current config to format historical invoices
		const [currentConfig, result] = await Promise.all([
			getUserConfig(),
			invoiceQuery().execute({ userId: session.user.id }),
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
export async function fetchInvoicesForClient(clientId: string, limit?: number) {
	const session = await auth();

	const clientDataId = db
		.$with('clientDataId')
		.as(
			db
				.select({ id: clientData.id })
				.from(clients)
				.where(eq(clients.id, clientId))
				.innerJoin(clientData, eq(clientData.clientId, clients.id)),
		);

	const query = invoiceQuery(false, db.with(clientDataId)).innerJoin(
		clientDataId,
		eq(invoicesWithSum.clientData, clientDataId.id),
	);

	if (limit) query.limit(limit);

	try {
		// Get current config to format historical invoices
		const [currentConfig, result] = await Promise.all([
			getUserConfig(),
			query.execute({ userId: session.user.id }),
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

/** Return type of `fetchInvoice()` */
export type DetailedInvoice = Awaited<ReturnType<typeof fetchInvoice>>;

/**
 * Join relational (incl. item) details with a single invoice record for authenticated user
 * @returns `Promise<InvoiceWithRelations>` */
export async function fetchInvoice(id: string) {
	const session = await auth();

	try {
		const taxContributions = db.$with('tax_contributions').as(
			db
				.select({
					taxId: itemTaxes.taxId,
					contribution:
						sql`SUM(${invoiceItems.netAmount} * ${taxesSchema.rate} * ${configSchema.taxRegistration}::INT)`
							.mapWith(Number)
							.as('contribution'),
				})
				.from(invoiceItems)
				.innerJoin(itemTaxes, eq(itemTaxes.itemId, invoiceItems.id))
				.innerJoin(taxesSchema, eq(taxesSchema.id, itemTaxes.taxId))
				.innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
				.innerJoin(configSchema, eq(invoices.config, configSchema.id))
				.where(eq(invoiceItems.invoiceId, id))
				.groupBy(itemTaxes.taxId),
		);

		const [[res], tax] = await Promise.all([
			invoiceQuery(true)
				.$dynamic()
				.where(and(eq(invoicesWithSum.id, id), eq(invoicesWithSum.userId, session.user.id)))
				.limit(1),

			// Get all active taxes, and calculate sum for display in the invoice subtotals
			db
				.with(taxContributions)
				.select({
					name: taxesSchema.name,
					rate: taxesSchema.rate,
					contribution: sql`COALESCE(${taxContributions.contribution}, 0)`.mapWith(Number),
				})
				.from(taxesSchema)
				.leftJoin(taxContributions, eq(taxContributions.taxId, taxesSchema.id))
				.where(and(eq(taxesSchema.userId, session.user.id), eq(taxesSchema.deleted, false)))
				.orderBy(asc(taxesSchema.order), desc(taxesSchema.rate)),
		]);

		if (!res) throw new Error('Invoice not found');

		const inv = {
			...res,
			formatted: { reference: invoiceReference(res, res.config.numberingScheme) },
		};

		return { ...inv, tax };
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoice');
	}
}

export async function fetchClientStats(id: string) {
	const session = await auth();

	/** Access all invoices for a given client that have not been voided */
	const validityFilter = db
		.select({ ...getViewSelectedFields(invoicesWithSum) })
		.from(clients)
		.leftJoin(clientData, eq(clientData.clientId, clients.id))
		.leftJoin(invoicesWithSum, eq(invoicesWithSum.clientData, clientData.id))
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
	const session = await auth();

	const user = await db.query.users.findFirst({
		where: eq(users.id, session.user.id),
	});

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
	const session = await auth();

	try {
		const invoiceCounts = db.$with('invoice_counts').as(
			db
				.select({
					clientId: clients.id,
					/** Includes voided invoices */
					count: count(invoices).as('count'),
				})
				.from(clients)
				.leftJoin(clientData, eq(clientData.clientId, clients.id))
				.leftJoin(invoices, eq(invoices.clientData, clientData.id))
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
					scdId: clients.id,
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
			.groupBy(clients.id, clientData.name, clientData.email, invoiceCounts.count)
			.orderBy(clientData.name)
			.then(res => (id ? res[0] : res));
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices.');
	}
}

/** Gets the active configuration for the authenticated user */
export async function getUserConfig() {
	const session = await auth();

	try {
		const settings = await db.query.config.findFirst({
			where: and(eq(configSchema.userId, session.user.id), isNull(configSchema.validTo)),
			with: {
				user: {
					with: {
						tax: { where: (taxes, { eq }) => eq(taxes.deleted, false) },
					},
				},
			},
			orderBy: [asc(taxesSchema.id), desc(configSchema.validFrom)],
		});

		if (!settings) {
			// If user has no current config
			throw new Error('User has no current valid config.');
		}

		const { tax, ...user } = settings.user;

		return {
			...settings,
			// Omit return of (hashed) password
			user: {
				email: user.email,
				emailVerified: user.emailVerified,
				id: user.id,
				image: user.image,
				name: user.name,
			},
			tax,
		};
	} catch (error) {
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	}
}
