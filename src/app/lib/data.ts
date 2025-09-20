'use server';

import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { clients, config, invoices } from '@/db/schema';
import { db, type Transaction } from '@/src/db';
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
				date: invoices.created_at,
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
			.orderBy(desc(invoices.created_at));

		return result;
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices');
	}
}
/** Return type of `fetchInvoices()` */
export type InvoiceWithClient = Awaited<ReturnType<typeof fetchInvoices>>[number];

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
