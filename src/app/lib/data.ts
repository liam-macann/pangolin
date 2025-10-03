'use server';

import { and, desc, eq, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, type Transaction } from '@/db';
import { clients, config, invoiceItems, invoices, itemsWithTax } from '@/db/schema';
/**
 * Join client details with invoice records for authenticated user
 * @returns `Promise<InvoiceWithClient[]>` */
export async function fetchInvoices() {
	const session = await auth();
	if (!session?.user?.id) {
		throw new Error('User is not authenticated');
	}

	try {
		const result = await db
			.select({
				id: invoices.id,
				status: invoices.status,
				date: invoices.createdAt,
				index: invoices.index,
				yearIndex: invoices.yearIndex,
				clientId: invoices.clientId,
				clientName: clients.name,
				clientEmail: clients.email,
			})
			.from(invoices)
			.where(eq(invoices.userId, session.user.id))
			.innerJoin(clients, eq(invoices.clientId, clients.id))
			.orderBy(desc(invoices.createdAt));

		return result;
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
	if (!session?.user?.id) {
		throw new Error('User is not authenticated');
	}

	try {
		const [res, [sums]] = await Promise.all([
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

		return { ...inv, ...sums };
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoice');
	}
}

/** Fetch all clients for authenticated user */
export async function fetchClient() {
	const session = await auth();
	if (!session?.user?.id) throw new Error('User is not authenticated');

	try {
		return await db.select().from(clients).where(eq(clients.userId, session.user.id));
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices.');
	}
}

export async function getUserConfig(
	/** Optionally permit calling within a transaction */
	tx?: Transaction,
) {
	const q = tx || db;

	const session = await auth();
	if (!session?.user?.id) throw new Error('User is not authenticated');

	try {
		const [settings] = await q
			.select()
			.from(config)
			.where(eq(config.userId, session.user.id))
			.orderBy(desc(config.validFrom))
			.limit(1);

		if (!settings) {
			// If user has no config, create one. Will error if user does not exist.
			return q
				.insert(config)
				.values({
					userId: session.user.id,
					timezone: 'Australia/Sydney',
				})
				.returning()
				.then(v => v[0]);
		} else if (settings.validTo != null) {
			// If user has no current config
			throw new Error('User has no current valid config.');
		}

		return settings;
	} catch (error) {
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	}
}
