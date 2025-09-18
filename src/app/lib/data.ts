'use server';

import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { clients, config, invoices } from '@/db/schema';
import { db } from '@/src/db';
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
				date: invoices.date,
				clientId: invoices.clientId,
				clientName: clients.name,
				clientEmail: clients.email,
			})
			.from(invoices)
			.where(eq(invoices.userId, session.user.id))
			.innerJoin(clients, eq(invoices.clientId, clients.id))
			.orderBy(desc(invoices.date));

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

export async function getUserConfig(id: string) {
	try {
		// Get config, or create it if it doesn't exist
		const settings = await db
			.insert(config)
			.values({
				userId: id,
			})
			.onConflictDoUpdate({
				target: config.userId,
				set: { userId: id }, // No-op update: returns the row
			})
			.returning();

		if (!settings) throw new Error('User does not exist');
		return settings[0];
	} catch (error) {
		console.error('Failed to fetch config:', error);
		throw new Error('Failed to fetch config.');
	}
}
