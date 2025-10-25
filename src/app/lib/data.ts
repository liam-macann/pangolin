'use server';

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import {
	clients,
	config as configSchema,
	invoiceItems,
	invoices,
	itemsWithTax,
	itemTaxes,
	taxes as taxesSchema,
} from '@/db/schema';
import { formatCurrency, formatDateToLocal } from '@/lib/utils';

/**
 * Join client details with invoice records for authenticated user
 * @returns `Promise<InvoiceWithClient[]>` */
export async function fetchInvoices() {
	const session = await auth();

	try {
		const [c, result] = await Promise.all([
			getUserConfig(),
			db
				.select({
					id: invoices.id,
					status: invoices.status,
					createdAt: invoices.createdAt,
					index: invoices.index,
					yearIndex: invoices.yearIndex,
					issuedAt: invoices.issuedAt,
					issueYear: sql`EXTRACT(YEAR FROM ${invoices.issuedAt})`.mapWith(Number),
					clientId: invoices.clientId,
					clientName: clients.name,
					clientEmail: clients.email,
					currency: configSchema.currency,
					grossTotal: sql`COALESCE(SUM(${itemsWithTax.grossAmount}), 0)`.mapWith(Number),
				})
				.from(invoices)
				.where(eq(invoices.userId, session.user.id))
				.innerJoin(clients, eq(invoices.clientId, clients.id))
				.innerJoin(configSchema, eq(invoices.config, configSchema.id))
				.innerJoin(itemsWithTax, eq(invoices.id, itemsWithTax.invoiceId))
				.groupBy(
					invoices.id,
					invoices.status,
					invoices.createdAt,
					invoices.index,
					invoices.yearIndex,
					invoices.issuedAt,
					invoices.clientId,
					clients.name,
					clients.email,
					configSchema.currency,
				)
				.orderBy(desc(invoices.createdAt)),
		]);

		return result.map(res => ({
			...res,
			/** Values formatted according to current locale */
			formatted: {
				grossTotal: formatCurrency(res.grossTotal, res.currency, c.locale),
				issuedAt: formatDateToLocal(res.issuedAt, false, c.locale),
			},
		}));
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices');
	}
}
/** Return type of `fetchInvoices()` */
export type InvoiceWithClient = Awaited<ReturnType<typeof fetchInvoices>>[number];

/**
 * Join client, user, and item details with a single invoice record for authenticated user
 * @returns `Promise<InvoiceWithClient>` */
export async function fetchInvoice(id: string) {
	const session = await auth();

	try {
		// This probably ought to be subqueries
		const [res, [sums], tax] = await Promise.all([
			db.query.invoices.findFirst({
				where: and(eq(invoices.id, id), eq(invoices.userId, session.user.id)),
				with: {
					client: true,
					user: true,
					config: true,
					items: {
						columns: {
							id: false,
							invoiceId: false,
							order: false,
						},
						orderBy: [invoiceItems.order, invoiceItems.label],
						with: {
							itemTax: {
								with: {
									tax: {
										columns: { id: true, name: true, rate: true },
									},
								},
							},
						},
					},
				},
			}),

			db
				.select({
					netTotal: sql`(
            SELECT SUM(net_amount)
            FROM items_with_tax
            WHERE invoice_id = ${id}
            )`
						.mapWith(Number)
						.as('net_total'),
					grossTotal: sql`(
            SELECT SUM(gross_amount)
            FROM items_with_tax
            WHERE invoice_id = ${id}
            )`
						.mapWith(Number)
						.as('gross_total'),
				})
				.from(itemsWithTax)
				.where(eq(itemsWithTax.invoiceId, id))
				.groupBy(itemsWithTax.invoiceId)
				.limit(1),

			db
				.select({
					name: taxesSchema.name,
					rate: taxesSchema.rate,
					contribution:
						sql`COALESCE(SUM(${invoiceItems.netAmount} * ${taxesSchema.rate} * ${configSchema.taxRegistration}::INT), 0)`.mapWith(
							Number,
						),
				})
				.from(taxesSchema)
				.leftJoin(itemTaxes, eq(itemTaxes.taxId, taxesSchema.id))
				.leftJoin(
					invoiceItems,
					and(eq(itemTaxes.itemId, invoiceItems.id), eq(invoiceItems.invoiceId, id)),
				)
				.leftJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
				.leftJoin(configSchema, eq(invoices.config, configSchema.id))
				.where(eq(taxesSchema.userId, session.user.id))
				.groupBy(taxesSchema.id, taxesSchema.name, taxesSchema.rate, configSchema.id)
				.orderBy(asc(taxesSchema.order), desc(taxesSchema.rate)),
		]);

		if (!res) throw new Error('Invoice not found');

		// Reduce tax join table (in RQBv2 this will be done via 'through')
		const inv = {
			...res,
			items: res.items.map(({ itemTax, ...item }) => {
				const tax = itemTax.map(itemTax => itemTax.tax);
				return { ...item, tax };
			}),
		};

		return { ...inv, ...sums, tax };
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoice');
	}
}

/** Fetch all clients for authenticated user */
export async function fetchClient() {
	const session = await auth();

	try {
		return await db.select().from(clients).where(eq(clients.userId, session.user.id));
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices.');
	}
}

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

		return settings;
	} catch (error) {
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	}
}
