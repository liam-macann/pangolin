'use server';

import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { customers, invoices } from '@/db/schema';
import { db } from '@/src/db';
/**
 * Join customer details with invoice records for authenticated user
 * @returns `Promise<InvoiceWithCustomer[]>` */
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
				customerId: invoices.customerId,
				customerName: customers.name,
				customerEmail: customers.email,
			})
			.from(invoices)
			.where(eq(invoices.userId, session.user.id))
			.innerJoin(customers, eq(invoices.customerId, customers.id))
			.orderBy(desc(invoices.date));

		return result;
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices');
	}
}
/** Return type of `fetchInvoices()` */
export type InvoiceWithCustomer = Awaited<ReturnType<typeof fetchInvoices>>[number];

/** Fetch all customers for authenticated user */
export async function fetchCustomers() {
	const session = await auth();
	if (!session?.user?.id) throw new Error('User is not authenticated');

	try {
		return await db.select().from(customers).where(eq(customers.userId, session.user.id));
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices.');
	}
}
