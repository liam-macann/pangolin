'use server';

import { and, eq, sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { match } from 'ts-pattern';
import type z from 'zod';

import { allocateSequence } from '@/lib/sequencer';
import { type Enum } from '@/lib/utils/drizzle';
import { invoice as zodSchema } from '@/lib/validation/invoice';
import { withRLS } from '@/db';
import * as schema from '@/db/schema';

import { createDocument } from './document';

export async function createInvoice(input: z.input<typeof zodSchema>) {
	// Validate form using Zod
	const { notes, status, ...invoice } = await zodSchema.parseAsync(input);

	return withRLS(async (tx, session) => {
		const insertedDocument = await createDocument(input);

		const [{ timezone, numberingScheme }] = await tx
			.select({ timezone: schema.config.timezone, numberingScheme: schema.config.numberingScheme })
			.from(schema.config)
			.where(eq(schema.config.id, insertedDocument.configId));

		/** When the invoice is set to be issued — either the supplied date, or the current time */
		const issuedAt =
			invoice.issuedAt?.toISOString() || sql`transaction_timestamp() AT TIME ZONE ${timezone}`;

		const partition = match(numberingScheme)
			.with('sequential', () => null)
			.with('annual', () => sql<string>`extract(year from (${issuedAt})::date)::text`)
			.exhaustive();

		const count = await allocateSequence(tx, {
			userId: session.user.id,
			namespace: 'invoice',
			partition,
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

					partition,
					index: count,
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
	const parsed = await zodSchema.shape.notes.parseAsync(notes);

	await withRLS(async (db, session) => {
		await db
			.update(schema.invoiceStatus)
			.set({ notes: parsed ?? null })
			.where(
				and(eq(schema.invoiceStatus.id, id), eq(schema.invoiceStatus.userId, session.user.id)),
			);

		updateTag(`invoices-${session.user.id}`);
	});
}
