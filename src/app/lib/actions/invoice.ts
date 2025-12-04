'use server';

import { type AnyColumn, and, desc, eq, isNull, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { v4 as uuid } from 'uuid';
import type z from 'zod';
import { getSession } from '@/auth';
import { db } from '@/db';
import {
	config as configSchema,
	invoiceCount,
	invoiceItems,
	invoices as invoicesSchema,
	itemTaxes,
	type statusEnum,
} from '@/db/schema';

import type { Enum } from '../utils/drizzle';

const increment = (column: AnyColumn, value = 1) => sql`${column} + ${value}`;

type InvoiceData = Pick<
	typeof invoicesSchema.$inferInsert,
	'clientData' | 'title' | 'description' | 'notes'
> & {
	// These are naively accepted in timezone of record, truncated to only date. createdAt stores a tz timestamp.
	issuedAt?: Date;
	dueAt: Date;
	status?: (typeof invoicesSchema.$inferInsert)['status'];
};

type InvoiceItemData = Pick<
	typeof invoiceItems.$inferInsert,
	'label' | 'note' | 'quantity' | 'unit' | 'unitCost' | 'order'
>;

interface CreateInvoiceData {
	invoice: InvoiceData;

	items: (InvoiceItemData & {
		/** Supply applicable taxes as array of tax IDs */
		taxes: string[];
	})[];
}

export async function createInvoice({ invoice, items }: CreateInvoiceData) {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	// Pre request validation. Validation has also been performed on the client side.
	const inputSchema = createInsertSchema(invoicesSchema, {
		issuedAt: s => s.nullable(), // Has default set in transaction logic (current date in timezone of record)
	})
		// Omit generated fields
		.omit({
			id: true,
			index: true,
			yearIndex: true,
			config: true,
			createdAt: true,
		});

	// Explicit about accepted input to prevent injecting via spread operator
	const defaults: z.infer<typeof inputSchema> = {
		clientDataId: invoice.clientData,
		title: invoice.title,
		description: invoice.description,
		status: invoice.status || 'unpaid',
		notes: invoice.notes,
		issuedAt: invoice.issuedAt?.toISOString() || null,
		dueAt: invoice.dueAt.toISOString(),

		// Ensure invoice is created for authenticated user, not supplied ID
		userId: session.user.id,
	};

	// Validate form using Zod
	const validated = inputSchema.safeParse(defaults);

	// If form validation fails, return errors early. Otherwise, continue.
	if (!validated.success) throw new Error('Failed to create invoice. Ensure all fields are valid.');

	return db
		.transaction(async tx => {
			const tzSubquery = tx
				.select({ timezone: configSchema.timezone })
				.from(configSchema)
				.where(and(eq(configSchema.userId, session.user.id), isNull(configSchema.validTo)))
				.orderBy(desc(configSchema.validFrom))
				.limit(1)
				.getSQL();

			// Upsert watermark table with invoice count
			const [count] = await tx
				.insert(invoiceCount)
				.values({
					userId: session.user.id,
					updatedAt: sql`transaction_timestamp()`,
					count: 1,
					yearCount: 1,
				})
				.onConflictDoUpdate({
					target: invoiceCount.userId,
					set: {
						updatedAt: sql`transaction_timestamp()`,
						count: increment(invoiceCount.count),
						yearCount: sql`
        				CASE
      				  -- Evaluate against config time zone. If the year is after the tracked date, reset the yearly counter.
                    WHEN EXTRACT(YEAR FROM transaction_timestamp() AT TIME ZONE (${tzSubquery}))
                      > EXTRACT(YEAR FROM ${invoiceCount.updatedAt} AT TIME ZONE (${tzSubquery}))
                    THEN 1
                    -- Evaluate against config time zone. If the year is the same, increment the year count.
                    WHEN EXTRACT(YEAR FROM transaction_timestamp() AT TIME ZONE (${tzSubquery}))
                        = EXTRACT(YEAR FROM ${invoiceCount.updatedAt} AT TIME ZONE (${tzSubquery}))
                    THEN ${invoiceCount.yearCount} + 1
                    -- If now() is before the tracked date, do nothing.
                    ELSE ${invoiceCount.yearCount}
                END
                `,
					},
					where: and(eq(invoiceCount.userId, session.user.id)),
				})
				.returning({
					count: invoiceCount.count,
					yearCount: invoiceCount.yearCount,
				});

			// CTE, executed within insert to retrieve current valid config
			const [c] = await tx
				.select({
					id: configSchema.id,
					userId: configSchema.userId,
					timezone: configSchema.timezone,
					taxRegistration: configSchema.taxRegistration,
				})
				.from(configSchema)
				.where(and(eq(configSchema.userId, session.user.id), isNull(configSchema.validTo)))
				.orderBy(desc(configSchema.validFrom))
				.limit(1);

			const [insertedInvoice] = await tx
				.insert(invoicesSchema)
				.values([
					{
						userId: validated.data.userId,
						clientData: validated.data.clientDataId,

						title: validated.data.title,
						description: validated.data.description,
						status: validated.data.status,
						notes: validated.data.notes,

						issuedAt:
							validated.data.issuedAt || sql`transaction_timestamp() AT TIME ZONE ${c.timezone}`,
						dueAt: validated.data.dueAt,

						index: count.count,
						yearIndex: count.yearCount,

						config: c.id,
					},
				])
				.returning({ id: invoicesSchema.id });

			// Necessary to have stable ID to link taxes with items
			const itemsWithId = items.map((item, i) => ({
				...item,
				id: uuid(),
				order: i,
			}));

			// Insert items for invoice
			await tx
				.insert(invoiceItems)
				.values(
					itemsWithId.map(i => ({
						id: i.id,
						invoiceId: insertedInvoice.id,

						label: i.label,
						note: i.note,

						quantity: i.quantity,
						unit: i.unit,
						unitCost: i.unitCost,

						order: i.order,
						config: c.id,
					})),
				)
				.then(async () => {
					// Link items with taxes, if registered
					if (c.taxRegistration) {
						await tx.insert(itemTaxes).values(
							itemsWithId.flatMap(item =>
								item.taxes.map(taxId => ({
									itemId: item.id,
									taxId,
									config: c.id,
								})),
							),
						);
					}
				});
		})
		.then(() => revalidatePath('/dashboard/invoices'))
		.catch(err => {
			console.error(err);
			throw new Error(`Database Error: failed to create invoice`);
		});
}

export async function updateInvoiceStatus(id: string, status: Enum<typeof statusEnum>) {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	await db
		.update(invoicesSchema)
		.set({ status })
		.where(and(eq(invoicesSchema.id, id), eq(invoicesSchema.userId, session.user.id)));
}

export async function voidInvoice(id: string) {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	await db
		.update(invoicesSchema)
		.set({ isVoid: true })
		.where(and(eq(invoicesSchema.id, id), eq(invoicesSchema.userId, session.user.id)));
}
