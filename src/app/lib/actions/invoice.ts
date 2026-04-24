'use server';

import { type AnyColumn, and, desc, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { v4 as uuid } from 'uuid';
import type z from 'zod';

import { type Enum } from '@/lib/utils/drizzle';
import { invoice as schema } from '@/lib/validation/invoice';
import { db } from '@/db';
import {
	config as configSchema,
	invoiceCount,
	invoiceItems,
	invoices as invoicesSchema,
	itemTaxes,
	type statusEnum,
} from '@/db/schema';

import { getSession } from '@/auth';

const increment = (column: AnyColumn, value = 1) => sql`${column} + ${value}`;

export async function createInvoice(input: z.infer<typeof schema>) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	// Validate form using Zod
	const { items, ...invoice } = schema.parse(input);

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
						...invoice,

						userId: session.user.id,

						issuedAt:
							invoice.issuedAt?.toISOString() ||
							sql`transaction_timestamp() AT TIME ZONE ${c.timezone}`,
						dueAt: invoice.dueAt.toISOString(),

						index: count.count,
						yearIndex: count.yearCount,

						configId: c.id,
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
						configId: c.id,
					})),
				)
				.then(async () => {
					// Link items with taxes, if registered
					if (c.taxRegistration) {
						const values = itemsWithId.flatMap(item =>
							[...item.taxes].map(taxId => ({
								itemId: item.id,
								taxId,
								configId: c.id,
							})),
						);

						await tx.insert(itemTaxes).values(values);
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
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	await db
		.update(invoicesSchema)
		.set({ status })
		.where(and(eq(invoicesSchema.id, id), eq(invoicesSchema.userId, session.user.id)));
}

export async function voidInvoice(id: string) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	await db
		.update(invoicesSchema)
		.set({ isVoid: true })
		.where(and(eq(invoicesSchema.id, id), eq(invoicesSchema.userId, session.user.id)));
}

export async function setInvoiceNotes(id: string, notes: string) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	await db
		.update(invoicesSchema)
		.set({ notes })
		.where(and(eq(invoicesSchema.id, id), eq(invoicesSchema.userId, session.user.id)));
}
