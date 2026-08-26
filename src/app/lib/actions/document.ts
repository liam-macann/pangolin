import 'server-only';

import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import type z from 'zod';

import { document as zodSchema } from '@/lib/validation/document';
import { withRLS } from '@/db';
import * as schema from '@/db/schema';

export async function createDocument(input: z.infer<typeof zodSchema>) {
	// Validate input using Zod
	const { items, ...document } = await zodSchema.parseAsync(input);

	return await withRLS(async (tx, session) => {
		const currentConfig = await tx.query.config.findFirst({
			columns: { id: true, taxRegistration: true },
			where: { validTo: { isNull: true }, userId: session.user.id },
			orderBy: { validFrom: 'desc' },
		});

		if (!currentConfig) notFound();

		// Throws notFound() if client does not exist, or is owned by another tenant
		await tx.query.clientData
			.findFirst({ where: { id: document.clientDataId, userId: session.user.id } })
			.then(client => client || notFound());

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
		const itemsWithId = items.map((item, i) => ({ ...item, id: randomUUID(), order: i }));

		// Insert line items
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
