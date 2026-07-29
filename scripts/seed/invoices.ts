import { faker } from '@faker-js/faker';
import { addDays, format, parseISO, startOfYear } from 'date-fns';

import * as schema from '@/db/schema';

import { type Transaction } from '@/scripts/db';

import { type ClientRecord } from './clients';
import { activeAt, type ScdVersion } from './utils';

function dateInYear(year: number, index: number, total: number): string {
	const dayOfYear = Math.max(1, Math.round((index / total) * 364));
	return format(addDays(startOfYear(new Date(year, 0)), dayOfYear - 1), 'yyyy-MM-dd');
}

export async function seedInvoiceCounters(
	tx: Transaction,
	userId: string,
	total: number,
	yearCounts: Record<number, number>,
) {
	await tx.insert(schema.sequencer).values({ userId, count: total, namespace: 'invoice' });

	await tx.insert(schema.sequencer).values(
		Object.entries(yearCounts).map(
			([year, count]) =>
				({
					userId,
					namespace: 'invoice',
					partition: year,
					count,
				}) as const,
		),
	);
}

export async function seedInvoices(
	tx: Transaction,
	userId: string,
	configVersions: ScdVersion[],
	clients: ClientRecord[],
	taxIds: string[],
	yearCounts: Record<number, number>,
) {
	const invoiceRows: (typeof schema.invoices.$inferInsert)[] = [];
	const statusRows: (typeof schema.invoiceStatus.$inferInsert)[] = [];
	const itemRows: (typeof schema.lineItems.$inferInsert)[] = [];
	const itemTaxRows: (typeof schema.itemTaxes.$inferInsert)[] = [];

	let globalIndex = 1;

	for (const [year, yearTotal] of Object.entries(yearCounts)) {
		const y = Number(year);

		for (let yearIndex = 1; yearIndex <= yearTotal; yearIndex++) {
			const invoiceId = faker.string.uuid();
			const issuedAt = dateInYear(y, yearIndex, yearTotal);
			const invoiceDate = parseISO(issuedAt);
			const dueAt = format(
				addDays(invoiceDate, faker.number.int({ min: 14, max: 60 })),
				'yyyy-MM-dd',
			);

			// Pick the config and client data that were active when this invoice was issued
			const config = activeAt(configVersions, invoiceDate);
			const client = faker.helpers.arrayElement(clients);
			const clientData = activeAt(client.versions, invoiceDate);

			invoiceRows.push({
				id: invoiceId,
				userId,
				clientDataId: clientData.id,
				configId: config.id,
				issuedAt,
				dueAt,
				index: globalIndex,
				yearIndex,
				description:
					faker.helpers.maybe(() => faker.lorem.sentences({ min: 1, max: 3 }), {
						probability: 0.2,
					}) ?? null,
			});

			statusRows.push({
				id: invoiceId,
				userId,
				status: faker.helpers.arrayElement(schema.statusEnum.enumValues),
				isVoid: faker.datatype.boolean({ probability: 0.1 }),
			});

			const itemCount = faker.number.int({ min: 1, max: 15 });
			for (let j = 0; j < itemCount; j++) {
				const itemId = faker.string.uuid();

				itemRows.push({
					id: itemId,
					invoiceId,
					userId,
					configId: config.id,
					label: faker.commerce.productName(),
					quantity: faker.number.int({ min: 1, max: 30 }),
					unitCost: faker.number.float({ min: 1, max: 500, fractionDigits: 2 }),
					note:
						faker.helpers.maybe(() => faker.commerce.productDescription(), { probability: 0.2 }) ??
						null,
					order: j,
				});

				itemTaxRows.push({
					itemId,
					taxId: faker.helpers.arrayElement(taxIds),
					userId,
					configId: config.id,
				});
			}

			globalIndex++;
		}
	}

	await tx.insert(schema.invoices).values(invoiceRows);
	await tx.insert(schema.invoiceStatus).values(statusRows);
	await tx.insert(schema.lineItems).values(itemRows);
	await tx.insert(schema.itemTaxes).values(itemTaxRows);
}
