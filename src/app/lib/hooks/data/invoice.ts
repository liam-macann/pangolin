import { type QueryFunctionContext } from '@tanstack/react-query';
import { type InferResponseType } from 'hono/client';

import rpc from '#rpc';
import { type Invoice } from '@/api/dto/invoice';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { declareQueries, type QueryOptionsFor } from './helpers';
import { createOptimisticResource } from './mutation';

const invoiceRoot = ['invoices'] as const;

export const invoiceQueries = declareQueries({
	list: (clientId?: string) => ({
		queryKey: [...invoiceRoot, 'list', { client: clientId ?? null }] as const,
		queryFn: ({ signal }: QueryFunctionContext) =>
			parseAPIRes(
				rpc.invoices.$get({ query: clientId ? { client: clientId } : {} }, { init: { signal } }),
			),
	}),
});

type InvoicesResponse = InferResponseType<typeof rpc.invoices.$get, 200>;

const factory = createOptimisticResource<Invoice>({
	mutationKey: invoiceRoot,
	invalidates: () => [invoiceRoot],
});

const useOptimisticInvoiceQuery = <TData>(
	clientId: string | undefined,
	options?: QueryOptionsFor<InvoicesResponse, TData>,
) =>
	factory.useOptimisticQuery(
		{ ...invoiceQueries.list(clientId), ...options },
		(response, update) => ({ ...response, data: response.data.map(update) }),
	);

export const useInvoices = <TData = InvoicesResponse>(
	options?: QueryOptionsFor<InvoicesResponse, TData>,
) => useOptimisticInvoiceQuery(undefined, options);

export const useClientInvoices = <TData = InvoicesResponse>(
	clientId: string,
	options?: QueryOptionsFor<InvoicesResponse, TData>,
) => useOptimisticInvoiceQuery(clientId, options);

export const useInvoiceMutation = factory.useOptimisticMutation;
