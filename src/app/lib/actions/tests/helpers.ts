import { addDays } from 'date-fns';
import { desc, isNull } from 'drizzle-orm';
import { toMerged } from 'es-toolkit/object';
import { assert } from 'vitest';

import { createClient } from '@/lib/actions/client';
import { updateUserConfig } from '@/lib/actions/config';
import { createInvoice } from '@/lib/actions/invoice';
import { type ElementType, type Minimized, type PartialDeep } from '@/lib/utils';
import { withRLS } from '@/db';
import * as tables from '@/db/schema';

type ClientInput = Parameters<typeof createClient>[0];
type AddressInput = NonNullable<ClientInput['address']>;
type ConfigInput = Parameters<typeof updateUserConfig>[0];
type InvoiceInput = Parameters<typeof createInvoice>[0];
type InvoiceItemInput = ElementType<InvoiceInput['items']>;

/** Builds an address with optional overrides, merged onto a complete base */
export const addressBuilder = (overrides?: PartialDeep<AddressInput>): AddressInput => {
	const base: AddressInput = {
		streetAddress: ['1 Test St'],
		city: 'Sydney',
		administrativeArea: 'NSW',
		postalCode: '2000',
		country: 'AU',
		dependentLocality: undefined,
		sortingCode: undefined,
	};

	return toMerged(base, overrides ?? {});
};

/** Builds client data with optional overrides, merged onto a minimal base */
export const clientBuilder = (overrides?: PartialDeep<ClientInput>): ClientInput => {
	const base: Minimized<Omit<ClientInput, 'name'>> & ({ name: string } | { organization: string }) =
		{
			name: 'Alaric Wivell',
			organization: null,
			email: 'client@acme.example',
			address: null,
		};

	return toMerged(base, overrides ?? {});
};

/** Builds a config with optional overrides, merged onto a minimal base */
export const configBuilder = (overrides?: PartialDeep<ConfigInput>): ConfigInput => {
	const base: Minimized<ConfigInput> = {
		tradingName: 'Acme Pty Ltd',
		timezone: 'Australia/Sydney',
		email: undefined,
		phone: undefined,
		header: undefined,
		region: 'AU',
		currency: 'AUD',
		taxRegistration: false,
		paymentDetails: [],
		tradingNumber: [],
		numberingScheme: 'sequential',
		address: null,
		taxes: [],
	};

	return toMerged(base, overrides ?? {});
};

/** Builds an invoice line item with optional overrides, merged onto a minimal base */
export const invoiceItemBuilder = (overrides?: PartialDeep<InvoiceItemInput>): InvoiceItemInput => {
	const base: Minimized<InvoiceItemInput> = {
		label: 'Consulting services',
		quantity: 1,
		unitCost: 150,
		taxes: new Set<string>(),
	};

	return toMerged(base, overrides ?? {});
};

/** Builds an invoice with optional overrides, merged onto a minimal base. Required an associated client data id. */
export const invoiceBuilder = (
	overrides: PartialDeep<Omit<InvoiceInput, 'clientDataId'>> & Pick<InvoiceInput, 'clientDataId'>,
): InvoiceInput => {
	const { clientDataId, items: itemOverrides, ...rest } = overrides;

	const base: Minimized<Omit<InvoiceInput, 'clientDataId' | 'items'>> = {
		title: undefined,
		description: undefined,
		// Ensure chk_due_after_issued is safe by default
		dueAt: addDays(overrides.issuedAt ?? new Date(), 14),
		status: 'unpaid',
		notes: undefined,
	};

	return {
		clientDataId,
		...toMerged(base, rest),
		items: itemOverrides
			? itemOverrides.map(item => invoiceItemBuilder(item))
			: [invoiceItemBuilder()],
	};
};

/** Creates a client with active client data via the real action, returning the logical id and the active clientData id */
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
