'use server';

import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, type Transaction } from '@/db';
import { clients, config, invoiceItems, invoices, users } from '@/db/schema';
import type { ElementType } from '@/src/lib/utils';
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
				amount: invoices.amount,
				status: invoices.status,
				date: invoices.createdAt,
				issueYear: invoices.issueYear,
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
		// Returns array of duplicate invoice with every item
		const query = await db
			.select({
				...getTableColumns(invoices),
				issuedAt: sql<string>`${invoices.createdAt} AT TIME ZONE ${config.timezone}`.as(
					'issued_at',
				),
				client: { ...getTableColumns(clients) },
				user: { ...getTableColumns(users) },
				config: { ...getTableColumns(config) },
				item: { ...getTableColumns(invoiceItems) },
			})
			.from(invoices)
			.innerJoin(clients, eq(clients.id, invoices.clientId))
			.innerJoin(users, eq(users.id, invoices.userId))
			.innerJoin(config, eq(config.id, invoices.config))
			.leftJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
			.where(and(eq(invoices.id, id), eq(invoices.userId, session.user.id)));

		type SelectType = ElementType<typeof query>;
		type ReduceType = Omit<SelectType, 'issuedAt'> & {
			items: NonNullable<SelectType['item']>[];
			issuedAt: Date;
		};

		// Aggregates result into a single object
		const { item: _item, ...result } = query.reduce<ReduceType>(
			(acc, row) => {
				if (row.item) acc.items.push(row.item);
				return acc;
			},
			{ ...query[0], issuedAt: new Date(query[0].issuedAt), items: [] },
		);

		return result;
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
