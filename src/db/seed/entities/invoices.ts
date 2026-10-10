import { sql } from 'drizzle-orm';
import { pick } from 'es-toolkit/object';
import { Temporal } from 'temporal-polyfill';
import { match } from 'ts-pattern';

import type * as DTO from '@/api/dto/invoice';
import * as tables from '@/db/schema';
import { type Overrides, type SeedContext, type SeedOptions } from '@/db/seed/shared/context';
import {
	activeAt,
	inBuiltOrder,
	instantsBetween,
	overrideAt,
	type Validity,
} from '@/db/seed/shared/utils';

/** A pool of relational entities that an invoice may reference. */
type Dependencies = {
	configs: (Validity &
		Pick<
			typeof tables.config.$inferSelect,
			'id' | 'timezone' | 'numberingScheme' | 'taxRegistration'
		> & {
			/** IDs of the taxes the version offers */
			taxes: string[];
		})[];
	clients: { versions: (Validity & { id: string })[] }[];
};

/** What may be overridden for a seeded line item. */
type ItemShape = Pick<
	typeof tables.lineItems.$inferInsert,
	'label' | 'note' | 'unit' | 'quantity' | 'unitCost'
> & {
	/** IDs of the taxes applied */
	taxes: string[];
};

/** What may be overridden for a seeded invoice. */
type InvoiceShape = Pick<
	DTO.Invoice,
	'issuedAt' | 'dueAt' | 'title' | 'description' | 'createdAt' | 'status'
> & {
	items: Partial<ItemShape>[];
	clientDataId: string;
};

/** Builds one line item of a document at its position in the list, apart from the taxes it lists. */
function buildItem(
	{ faker, userId }: SeedContext,
	parent: Pick<typeof tables.lineItems.$inferInsert, 'documentId' | 'configId'>,
	order: number,
	{ taxes, ...overrides }: Partial<ItemShape> = {},
) {
	const row = {
		userId,
		...parent,
		id: faker.string.uuid(),
		label: faker.commerce.productName(),
		quantity: `${faker.number.int({ min: 1, max: 30 })}`,
		unitCost: `${faker.number.float({ min: 1, max: 500, fractionDigits: 2 })}`,
		unit: faker.helpers.maybe(() => faker.helpers.arrayElement(tables.unitEnum.enumValues), {
			probability: 0.5,
		}),
		note: faker.helpers.maybe(() => faker.commerce.productDescription(), { probability: 0.2 }),
		order,
		...overrides,
	} satisfies typeof tables.lineItems.$inferInsert;

	return { row, taxes };
}

/** Builds the rows of one invoice created at an instant, mirroring what `createInvoice()` derives.
 *  @remarks The invoice is left unnumbered, as its index depends on the rest of its partition. */
function buildInvoice(
	ctx: SeedContext,
	generatedAt: Temporal.Instant,
	{ configs, clients }: Dependencies,
	overrides: Overrides<InvoiceShape> = {},
) {
	const { faker, userId } = ctx;

	const createdAt = Temporal.Instant.from(overrides.createdAt ?? generatedAt);
	const config = activeAt(configs, createdAt);

	const issuedAt = Temporal.PlainDate.from(
		overrides.issuedAt ?? createdAt.toZonedDateTimeISO(config.timezone).toPlainDate(),
	);

	const partition = match(config.numberingScheme)
		.with('sequential', () => null)
		.with('annual', () => String(issuedAt.year))
		.exhaustive();

	const id = faker.string.uuid();

	const items = faker.helpers.multiple(
		(_, order) =>
			buildItem(ctx, { documentId: id, configId: config.id }, order, overrides.items?.[order]),
		{ count: overrides.items?.length ?? { min: 1, max: 15 } },
	);

	return {
		document: {
			id,
			userId,
			configId: config.id,
			clientDataId:
				overrides.clientDataId ??
				activeAt(faker.helpers.arrayElement(clients).versions, createdAt).id,
			createdAt: createdAt.toString(),
			title: faker.helpers.maybe(() => faker.company.buzzPhrase(), { probability: 0.4 }),
			description: faker.helpers.maybe(() => faker.lorem.sentences({ min: 1, max: 3 }), {
				probability: 0.2,
			}),
			...pick(overrides, ['title', 'description']),
		} satisfies typeof tables.documents.$inferInsert,

		invoice: {
			id,
			userId,
			issuedAt: issuedAt.toString(),
			dueAt: issuedAt.add({ days: faker.number.int({ min: 14, max: 60 }) }).toString(),
			partition,
			...pick(overrides, ['dueAt']),
		} satisfies Omit<typeof tables.invoices.$inferInsert, 'index'>,

		status: {
			id,
			userId,
			status: faker.helpers.arrayElement(tables.statusEnum.enumValues),
			isVoid: faker.datatype.boolean({ probability: 0.1 }),
			notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
			...overrides.status,
		} satisfies typeof tables.invoiceStatus.$inferInsert,

		items: items.map(item => item.row),

		// Unless listed, items are only taxed while the business is registered for tax, and offers any
		itemTaxes: items.flatMap(item =>
			[
				...new Set(
					item.taxes ??
						(config.taxRegistration && config.taxes.length > 0
							? [faker.helpers.arrayElement(config.taxes)]
							: []),
				),
			].map(
				taxId =>
					({
						userId,
						configId: config.id,
						itemId: item.row.id,
						taxId,
					}) satisfies typeof tables.itemTaxes.$inferInsert,
			),
		),
	};
}

/** Seeds invoices across the history, numbered in creation order after any earlier batch
 * @remarks Subsequent batches will break correlation between issue date and reference number */
export async function seedInvoices(
	ctx: SeedContext,
	{ count = { min: 120, max: 250 }, overrides }: SeedOptions<InvoiceShape> = {},
	dependencies: Dependencies,
) {
	const { tx, userId } = ctx;

	const built = instantsBetween(ctx, count).map((time, i) =>
		buildInvoice(ctx, time, dependencies, overrideAt(overrides, i)),
	);

	const partitions = Map.groupBy(built, b => b.invoice.partition);

	// Advance each watermark past this batch, as allocateSequence() would for each invoice
	const watermarks = await tx
		.insert(tables.sequencer)
		.values(
			Array.from(partitions, ([partition, group]) => ({
				userId,
				namespace: 'invoice' as const,
				partition,
				count: group.length,
			})),
		)
		.onConflictDoUpdate({
			// Merge with previous batches
			target: [tables.sequencer.userId, tables.sequencer.namespace, tables.sequencer.partition],
			set: { count: sql`${tables.sequencer.count} + excluded.count` },
		})
		.returning({ partition: tables.sequencer.partition, last: tables.sequencer.count });

	const documents = await tx
		.insert(tables.documents)
		.values(built.map(b => b.document))
		.returning();

	// Numbered in creation order, which overrides may put out of step with the order built
	const invoices = await tx
		.insert(tables.invoices)
		.values(
			watermarks.flatMap(({ partition, last }) => {
				const group = (partitions.get(partition) ?? []).toSorted((a, b) =>
					Temporal.Instant.compare(a.document.createdAt, b.document.createdAt),
				);
				return group.map((b, i) => ({ ...b.invoice, index: last - group.length + i + 1 }));
			}),
		)
		.returning();

	const statuses = await tx
		.insert(tables.invoiceStatus)
		.values(built.map(b => b.status))
		.returning();

	// Overrides may leave every invoice without items
	const items = built.flatMap(b => b.items);
	if (items.length > 0) await tx.insert(tables.lineItems).values(items);

	const itemTaxes = built.flatMap(b => b.itemTaxes);
	if (itemTaxes.length > 0) await tx.insert(tables.itemTaxes).values(itemTaxes);

	// An invoice shares its id with its document and status
	const documentById = new Map(documents.map(document => [document.id, document]));
	const statusById = new Map(statuses.map(status => [status.id, status]));

	// Sort result so that each invoice lines up with its override, flattened as the DTO is
	return inBuiltOrder(
		invoices,
		built.map(b => b.invoice),
	).flatMap(invoice => {
		const document = documentById.get(invoice.id);
		const status = statusById.get(invoice.id);
		return document && status ? [{ ...document, ...invoice, status }] : [];
	});
}
