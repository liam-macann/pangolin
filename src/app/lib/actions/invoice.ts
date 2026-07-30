'use server';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import type z from 'zod';

import { allocateSequence } from '@/lib/sequencer';
import { type Enum } from '@/lib/utils/drizzle';
import { document as documentSchema, invoice as zodSchema } from '@/lib/validation/invoice';
import { withRLS } from '@/db';
import * as schema from '@/db/schema';

export async function createInvoice(input: z.infer<typeof zodSchema>) {
	// Validate form using Zod
	const { notes, status, ...invoice } = await zodSchema.parseAsync(input);

	return withRLS(async (tx, session) => {
		const insertedDocument = await createDocument(input);

		const [{ timezone }] = await tx
			.select({ timezone: schema.config.timezone })
			.from(schema.config)
			.where(eq(schema.config.id, insertedDocument.configId));

		/** When the invoice is set to be issued — either the supplied date, or the current time */
		const issuedAt =
			invoice.issuedAt?.toISOString() || sql`transaction_timestamp() AT TIME ZONE ${timezone}`;

		const count = await allocateSequence(tx, {
			userId: session.user.id,
			namespace: 'invoice',
		});
		const yearCount = await allocateSequence(tx, {
			userId: session.user.id,
			namespace: 'invoice',
			partition: sql`extract(year from (${issuedAt})::date)::text`,
		});

		// Logical invoice table
		const [insertedInvoice] = await tx
			.insert(schema.invoices)
			.values([
				{
					id: insertedDocument.id,
					userId: session.user.id,

					issuedAt,
					dueAt: invoice.dueAt.toISOString(),

					index: count,
					yearIndex: yearCount,
				},
			])
			.returning({ id: schema.invoices.id });

		// Insert invoice status
		await tx.insert(schema.invoiceStatus).values({
			id: insertedInvoice.id,
			userId: session.user.id,
			status,
			notes,
		});

		updateTag(`invoices-${session.user.id}`);
	}).catch(err => {
		unstable_rethrow(err);
		console.error(err);
		throw new Error(`Database Error: failed to create invoice`);
	});
}

async function createDocument(input: z.infer<typeof documentSchema>) {
	// Validate input using Zod
	const { items, ...document } = await documentSchema.parseAsync(input);

	return await withRLS(async (tx, session) => {
		const [currentConfig] = await tx
			.select({
				id: schema.config.id,
				userId: schema.config.userId,
				taxRegistration: schema.config.taxRegistration,
			})
			.from(schema.config)
			.where(and(eq(schema.config.userId, session.user.id), isNull(schema.config.validTo)))
			.orderBy(desc(schema.config.validFrom))
			.limit(1);

		// The document carries the invoice content (client, title, description)
		const [insertedDocument] = await tx
			.insert(schema.documents)
			.values([
				{
					...document,
					userId: session.user.id,
					configId: currentConfig.id,
				},
			])
			.returning({
				id: schema.documents.id,
				configId: schema.documents.configId,
			});

		// Necessary to have stable ID to link taxes with items
		const itemsWithId = items.map((item, i) => ({ ...item, id: uuid(), order: i }));

		// Insert items for invoice
		await tx
			.insert(schema.lineItems)
			.values(
				itemsWithId.map(i => ({
					id: i.id,
					documentId: insertedDocument.id,

					label: i.label,
					note: i.note,

					quantity: i.quantity,
					unit: i.unit,
					unitCost: i.unitCost,

					order: i.order,
					configId: currentConfig.id,
					userId: session.user.id,
				})),
			)
			.then(async () => {
				// Link items with taxes, if registered
				if (currentConfig.taxRegistration) {
					const values = itemsWithId.flatMap(item =>
						[...item.taxes].map(taxId => ({
							itemId: item.id,
							taxId,
							configId: currentConfig.id,
							userId: session.user.id,
						})),
					);

					if (values.length > 0) await tx.insert(schema.itemTaxes).values(values);
				}
			});

		return insertedDocument;
	});
}

export async function updateInvoiceStatus(id: string, status: Enum<typeof schema.statusEnum>) {
	await withRLS(async (db, session) => {
		await db
			.update(schema.invoiceStatus)
			.set({ status })
			.where(
				and(eq(schema.invoiceStatus.id, id), eq(schema.invoiceStatus.userId, session.user.id)),
			);

		updateTag(`invoices-${session.user.id}`);
	});
}

export async function voidInvoice(id: string) {
	await withRLS(async (db, session) => {
		await db
			.update(schema.invoiceStatus)
			.set({ isVoid: true })
			.where(
				and(eq(schema.invoiceStatus.id, id), eq(schema.invoiceStatus.userId, session.user.id)),
			);

		updateTag(`invoices-${session.user.id}`);
	});
}

export async function setInvoiceNotes(id: string, notes: string) {
	await withRLS(async (db, session) => {
		await db
			.update(schema.invoiceStatus)
			.set({ notes: notes.trim() || null })
			.where(
				and(eq(schema.invoiceStatus.id, id), eq(schema.invoiceStatus.userId, session.user.id)),
			);

		updateTag(`invoices-${session.user.id}`);
	});
}
