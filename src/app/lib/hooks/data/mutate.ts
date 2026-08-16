'use client';

import { type Client } from '@/api/dto/client';
import { type Invoice } from '@/api/dto/invoice';
import { client } from '@/lib/api';

import { createMutation, detail, list } from './mutator-factory';

type InvoiceArray = Invoice[];

//
// Mutation Hooks

/** Mutate client array and individual client simultaneously */
export const useMutateClient = createMutation<Client>(
	detail(id => client.clients[':id'].$path({ param: { id } })),
	list(() => client.clients.$path({ query: {} })),
);

/** Mutate invoices and client invoices simultaneously */
export const useMutateInvoice = createMutation<Invoice>(
	list(() => client.invoices.$path({ query: {} })),
	list((id, cache) => {
		const key = client.invoices.$path({ query: {} });
		const invoices: InvoiceArray | undefined = cache.get(key)?.data;
		const clientId = invoices?.find(item => item.id === id)?.clientData?.clientId;
		return clientId ? client.invoices.$path({ query: { client: clientId } }) : undefined;
	}),
);

/** Builds an optimistic partial patch to an invoice's status */
export const patchStatus =
	(partial: Partial<Invoice['status']>) =>
	(current: Invoice | undefined, displayed: Invoice | undefined): Invoice => {
		const item = displayed ?? current;
		if (!item) throw new Error('patchStatus requires the invoice to already be cached');
		return { ...item, status: { ...item.status, ...partial } };
	};
