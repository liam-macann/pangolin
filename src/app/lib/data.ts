import { and, asc, count, desc, eq, getTableColumns, isNotNull, isNull, sql } from 'drizzle-orm';
import type { PgSelectBase } from 'drizzle-orm/pg-core';
import { auth } from '@/auth';
import { db } from '@/db';
import {
	clientData,
	clients,
	config as configSchema,
	invoiceItems,
	invoices,
	itemsWithTax,
	itemTaxes,
	taxes as taxesSchema,
	users,
} from '@/db/schema';
import { formatCurrency, formatDateToLocal, invoiceReference } from '@/lib/utils';
import { jsonbAgg, jsonbBuildObject } from '@/lib/utils/drizzle';

/** Builder to return a single, aggregated query for invoices.
 *
 * @remarks Can be accessed and narrowed with `.$dynamic()` */
function invoiceQuery<Detailed extends boolean>(
	/** Detailed access required to print an entire invoice */
	detailed?: Detailed,
) {
	// Subquery to avoid grouping by every column on main query. Calculates total over entire invoice.
	const itemsAgg = db
		.select({
			invoiceId: itemsWithTax.invoiceId,
			netTotal: sql<number>`COALESCE(SUM(${itemsWithTax.netAmount}), 0)`.as('net_total'),
			grossTotal: sql<number>`COALESCE(SUM(${itemsWithTax.grossAmount}), 0)`.as('gross_total'),
		} as const)
		.from(itemsWithTax)
		.groupBy(itemsWithTax.invoiceId)
		.as('items_agg');

	// First-level aggregation: items + taxes
	const itemWithTaxes = db
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
		.groupBy(
			itemsWithTax.id,
			itemsWithTax.invoiceId,
			itemsWithTax.label,
			itemsWithTax.note,
			itemsWithTax.quantity,
			itemsWithTax.unit,
			itemsWithTax.unitCost,
			itemsWithTax.netAmount,
			itemsWithTax.order,
		)
		.as('item_with_taxes');

	// Second-level aggregation: invoice-level aggregation of items
	const itemsAggDetailed = db
		.select({
			invoiceId: itemWithTaxes.invoiceId,
			items: jsonbAgg(itemWithTaxes.item).as('invoice_items'),
		})
		.from(itemWithTaxes)
		.groupBy(itemWithTaxes.invoiceId)
		.as('items_agg_detailed');

	const baseSelect = {
		id: invoices.id,
		status: invoices.status,
		isVoid: invoices.isVoid,
		createdAt: invoices.createdAt,
		index: invoices.index,
		yearIndex: invoices.yearIndex,
		issuedAt: invoices.issuedAt,
		dueAt: invoices.dueAt,
		issueYear: invoices.issueYear,
		title: invoices.title,
		description: invoices.description,

		client: getTableColumns(clientData),

		config: {
			timezone: configSchema.timezone,
			locale: configSchema.locale,
			currency: configSchema.currency,
			taxRegistration: configSchema.taxRegistration,
			numberingScheme: configSchema.numberingScheme,
			colorScheme: configSchema.colorScheme,
		},

		netTotal: itemsAgg.netTotal,
		grossTotal: itemsAgg.grossTotal,
	} as const;

	const detailedSelect = {
		...baseSelect,
		items: itemsAggDetailed.items,
	};

	const query = db.select(detailed ? detailedSelect : baseSelect).from(invoices) as PgSelectBase<
		'invoice',
		Detailed extends true ? typeof detailedSelect : typeof baseSelect,
		'partial'
	>;

	return query
		.where(eq(invoices.userId, sql.placeholder('userId')))
		.innerJoin(clientData, eq(invoices.clientData, clientData.id))
		.innerJoin(configSchema, eq(invoices.config, configSchema.id))
		.leftJoin(itemsAgg, eq(invoices.id, itemsAgg.invoiceId))
		.leftJoin(itemsAggDetailed, eq(invoices.id, itemsAggDetailed.invoiceId))
		.orderBy(desc(invoices.createdAt));
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
				.where(and(eq(invoices.id, id), eq(invoices.userId, session.user.id)))
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

export async function getUser() {
	const session = await auth();

	const user = await db.query.users.findFirst({
		where: eq(users.id, session.user.id),
	});

	if (!user) throw new Error('User not found');
	return user;
}

/** Fetch all clients for authenticated user */
export async function fetchClients() {
	const session = await auth();

	try {
		const invoiceCounts = db.$with('invoice_counts').as(
			db
				.select({
					clientId: clients.id,
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
				isFavourite: clients.isFavorite,
				isDeleted: clients.isDeleted,
				invoiceCount: invoiceCounts.count,
				data: jsonbBuildObject({
					name: clientData.name,
					email: clientData.email,
				}),
			})
			.from(clients)
			.leftJoin(clientData, and(eq(clients.id, clientData.clientId), isNull(clientData.validTo)))
			.leftJoin(invoiceCounts, eq(clients.id, invoiceCounts.clientId))
			.where(eq(clients.userId, session.user.id))
			.groupBy(clients.id, clientData.name, clientData.email, invoiceCounts.count)
			.orderBy(clientData.name);
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
