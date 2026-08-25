'use client';

import { type QueryFunctionContext } from '@tanstack/react-query';

import { type Invoice } from '@/api/dto/invoice';
import { client } from '@/lib/api';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { type ListResponse, type QueryOptionsFor } from './helper';
import { createOptimisticResource } from './mutation';

export const invoiceKeys = {
	all: ['invoices'] as const,
	lists: () => ['invoices', 'list'] as const,
	list: (clientId?: string) => ['invoices', 'list', { client: clientId ?? null }] as const,
};

const factory = createOptimisticResource<Invoice>({
	mutationKey: invoiceKeys.all,
	invalidates: () => [invoiceKeys.all],
});

type InvoicesResponse = ListResponse<Invoice>;

function useOptimisticInvoiceQuery<TData>(
	clientId: string | undefined,
	options?: QueryOptionsFor<InvoicesResponse, TData>,
) {
	return factory.useOptimisticQuery(
		{
			queryKey: invoiceKeys.list(clientId),
			queryFn: ({ signal }: QueryFunctionContext) =>
				parseAPIRes(
					client.invoices.$get(
						{ query: clientId ? { client: clientId } : {} },
						{ init: { signal } },
					),
				),
			...options,
		},
		(response, update) => ({ ...response, data: response.data.map(update) }),
	);
}

export const useInvoices = <TData = InvoicesResponse>(
	options?: QueryOptionsFor<InvoicesResponse, TData>,
) => useOptimisticInvoiceQuery(undefined, options);

export const useClientInvoices = <TData = InvoicesResponse>(
	clientId: string,
	options?: QueryOptionsFor<InvoicesResponse, TData>,
) => useOptimisticInvoiceQuery(clientId, options);

export const useInvoiceMutation = factory.useOptimisticMutation;
