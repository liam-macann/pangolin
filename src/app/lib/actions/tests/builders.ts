import { toMerged } from 'es-toolkit/object';
import { Temporal } from 'temporal-polyfill';

import { type createClient } from '@/lib/actions/client';
import { type updateUserConfig } from '@/lib/actions/config';
import { type createInvoice } from '@/lib/actions/invoice';
import { type ElementType, type Minimized, type PartialDeep } from '@/lib/utils/type';

import { createBuilder } from '@/test/builders';

export type ClientInput = Parameters<typeof createClient>[0];
type AddressInput = NonNullable<ClientInput['address']>;
export type ConfigInput = Parameters<typeof updateUserConfig>[0];
export type InvoiceInput = Parameters<typeof createInvoice>[0];
type InvoiceItemInput = ElementType<InvoiceInput['items']>;

/** Builds an address with optional overrides, merged onto a complete base. */
export const addressBuilder = createBuilder<AddressInput>(() => ({
	streetAddress: ['1 Test St'],
	city: 'Sydney',
	administrativeArea: 'NSW',
	postalCode: '2000',
	country: 'AU',
	dependentLocality: undefined,
	sortingCode: undefined,
}));

/** Builds client data with optional overrides, merged onto a minimal base. */
export const clientBuilder = createBuilder<ClientInput>(
	(): Minimized<Omit<ClientInput, 'name'>> & ({ name: string } | { organization: string }) => ({
		name: 'Alaric Wivell',
		organization: null,
		email: 'client@acme.example',
		address: null,
	}),
);

/** Builds a config with optional overrides, merged onto a minimal base. */
export const configBuilder = createBuilder<ConfigInput>(
	(): Minimized<ConfigInput> => ({
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
	}),
);

/** Builds an invoice line item with optional overrides, merged onto a minimal base. */
export const invoiceItemBuilder = createBuilder<InvoiceItemInput>(
	(): Minimized<InvoiceItemInput> => ({
		label: 'Consulting services',
		quantity: 1,
		unitCost: 150,
		taxes: new Set<string>(),
	}),
);

/** Builds an invoice with optional overrides, merged onto a minimal base. */
export const invoiceBuilder = (
	overrides: PartialDeep<Omit<InvoiceInput, 'clientDataId'>> & Pick<InvoiceInput, 'clientDataId'>,
): InvoiceInput => {
	const { clientDataId, items: itemOverrides, ...rest } = overrides;

	const base: Minimized<Omit<InvoiceInput, 'clientDataId' | 'items'>> = {
		title: undefined,
		description: undefined,
		// Ensure chk_due_after_issued is safe by default
		dueAt: Temporal.PlainDate.from(overrides.issuedAt ?? Temporal.Now.plainDateISO())
			.add({ days: 14 })
			.toString(),
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
