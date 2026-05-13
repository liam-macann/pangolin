'use server';

import { type AnyColumn, and, desc, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { v4 as uuid } from 'uuid';
import type z from 'zod';

import { type Enum } from '@/lib/utils/drizzle';
import { invoice as zodSchema } from '@/lib/validation/invoice';
import { withRLS } from '@/db';
import * as schema from '@/db/schema';

const increment = (column: AnyColumn, value = 1) => sql`${column} + ${value}`;

export async function createInvoice(input: z.infer<typeof zodSchema>) {
	// Validate form using Zod
	const { items, notes, status, ...invoice } = zodSchema.parse(input);

	return withRLS(async (tx, session) => {
		const tzSubquery = tx
			.select({ timezone: schema.config.timezone })
			.from(schema.config)
			.where(and(eq(schema.config.userId, session.user.id), isNull(schema.config.validTo)))
			.orderBy(desc(schema.config.validFrom))
			.limit(1)
			.getSQL();

		// Upsert watermark table with invoice count
		const [count] = await tx
			.insert(schema.invoiceCount)
			.values({
				userId: session.user.id,
				updatedAt: sql`transaction_timestamp()`,
				count: 1,
				yearCount: 1,
			})
			.onConflictDoUpdate({
				target: schema.invoiceCount.userId,
				set: {
					updatedAt: sql`transaction_timestamp()`,
					count: increment(schema.invoiceCount.count),
					yearCount: sql`
        				CASE
      				  -- Evaluate against config time zone. If the year is after the tracked date, reset the yearly counter.
                    WHEN EXTRACT(YEAR FROM transaction_timestamp() AT TIME ZONE (${tzSubquery}))
                      > EXTRACT(YEAR FROM ${schema.invoiceCount.updatedAt} AT TIME ZONE (${tzSubquery}))
                    THEN 1
                    -- Evaluate against config time zone. If the year is the same, increment the year count.
                    WHEN EXTRACT(YEAR FROM transaction_timestamp() AT TIME ZONE (${tzSubquery}))
                        = EXTRACT(YEAR FROM ${schema.invoiceCount.updatedAt} AT TIME ZONE (${tzSubquery}))
                    THEN ${schema.invoiceCount.yearCount} + 1
                    -- If now() is before the tracked date, do nothing.
                    ELSE ${schema.invoiceCount.yearCount}
                END
                `,
				},
				where: and(eq(schema.invoiceCount.userId, session.user.id)),
			})
			.returning({
				count: schema.invoiceCount.count,
				yearCount: schema.invoiceCount.yearCount,
			});

		// CTE, executed within insert to retrieve current valid config
		const [c] = await tx
			.select({
				id: schema.config.id,
				userId: schema.config.userId,
				timezone: schema.config.timezone,
				taxRegistration: schema.config.taxRegistration,
			})
			.from(schema.config)
			.where(and(eq(schema.config.userId, session.user.id), isNull(schema.config.validTo)))
			.orderBy(desc(schema.config.validFrom))
			.limit(1);

		const [insertedInvoice] = await tx
			.insert(schema.invoices)
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
			.returning({ id: schema.invoices.id });

		const insertInvoiceStatus = tx.$with('insert_invoice_status').as(
			tx.insert(schema.invoiceStatus).values({
				id: insertedInvoice.id,
				userId: session.user.id,
				status,
				notes,
			}),
		);

		// Necessary to have stable ID to link taxes with items
		const itemsWithId = items.map((item, i) => ({
			...item,
			id: uuid(),
			order: i,
		}));

		// Insert items for invoice
		await tx
			.with(insertInvoiceStatus)
			.insert(schema.invoiceItems)
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
					userId: session.user.id,
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
							userId: session.user.id,
						})),
					);

					if (values.length > 0) await tx.insert(schema.itemTaxes).values(values);
				}
			});
	})
		.then(() => revalidatePath('/dashboard/invoices'))
		.catch(err => {
			console.error(err);
			throw new Error(`Database Error: failed to create invoice`);
		});
}

export async function updateInvoiceStatus(id: string, status: Enum<typeof schema.statusEnum>) {
	await withRLS((db, session) =>
		db
			.update(schema.invoiceStatus)
			.set({ status })
			.where(
				and(eq(schema.invoiceStatus.id, id), eq(schema.invoiceStatus.userId, session.user.id)),
			),
	);
}

export async function voidInvoice(id: string) {
	await withRLS((db, session) =>
		db
			.update(schema.invoiceStatus)
			.set({ isVoid: true })
			.where(
				and(eq(schema.invoiceStatus.id, id), eq(schema.invoiceStatus.userId, session.user.id)),
			),
	);
}

export async function setInvoiceNotes(id: string, notes: string) {
	await withRLS((db, session) =>
		db
			.update(schema.invoiceStatus)
			.set({ notes })
			.where(
				and(eq(schema.invoiceStatus.id, id), eq(schema.invoiceStatus.userId, session.user.id)),
			),
	);
}
