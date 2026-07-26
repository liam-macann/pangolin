'use client';

import { type Data as Client } from '@/api/clients/[id]/route';
import { type Data as InvoiceArray } from '@/api/invoices/route';
import { type ElementType } from '@/lib/utils';

import { createMutation, detail, list } from './mutator-factory';

type Invoice = ElementType<InvoiceArray>;

//
// Mutation Hooks

/** Mutate client array and individual client simultaneously */
export const useMutateClient = createMutation<Client>(
	detail(id => `/api/clients/${id}`),
	list(() => '/api/clients'),
);

/** Mutate invoices and client invoices simultaneously */
export const useMutateInvoice = createMutation<Invoice>(
	list(() => '/api/invoices'),
	list((id, cache) => {
		const invoices: InvoiceArray | undefined = cache.get('/api/invoices')?.data;
		const clientId = invoices?.find(item => item.id === id)?.clientData?.clientId;
		return clientId ? `/api/invoices?client=${clientId}` : undefined;
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
