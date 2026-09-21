import { desc, isNull } from 'drizzle-orm';
import { assert } from 'vitest';

import { createClient } from '@/lib/actions/client';
import { updateUserConfig } from '@/lib/actions/config';
import { createInvoice } from '@/lib/actions/invoice';
import { type PartialDeep } from '@/lib/utils/type';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

import {
	type ClientInput,
	type ConfigInput,
	clientBuilder,
	configBuilder,
	type InvoiceInput,
	invoiceBuilder,
} from './builders';

/** Creates a client with active client data via the real action */
export async function insertTestClient(overrides?: PartialDeep<ClientInput>) {
	const { id, scdId } = await createClient(clientBuilder(overrides));
	return { id, data: { scdId } };
}

/** Creates an active config via the real action, returning its id */
export async function insertTestConfig(overrides?: PartialDeep<ConfigInput>) {
	await updateUserConfig(configBuilder(overrides));

	const [config] = await withRLS(db =>
		db.select({ id: tables.config.id }).from(tables.config).where(isNull(tables.config.validTo)),
	);

	assert(config, 'Config should have been inserted');
	return config.id;
}

/** Sets up an active config and a single client scoped to it */
export async function setUpConfigAndClient(configOverrides?: PartialDeep<ConfigInput>) {
	const configId = await insertTestConfig(configOverrides);
	const client = await insertTestClient();
	return { configId, client };
}

/** Creates an invoice via the real action, returning its id */
export async function insertTestInvoice(
	data: PartialDeep<Omit<InvoiceInput, 'clientDataId'>> & Pick<InvoiceInput, 'clientDataId'>,
) {
	await createInvoice(invoiceBuilder(data));

	const [invoice] = await withRLS(db =>
		db
			.select({ id: tables.invoices.id })
			.from(tables.invoices)
			.orderBy(desc(tables.invoices.index))
			.limit(1),
	);

	assert(invoice, 'Invoice should have been inserted');
	return invoice.id;
}
