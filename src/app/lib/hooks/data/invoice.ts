import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { type InferResponseType } from 'hono/client';

import rpc from '#rpc';
import { type Invoice } from '@/api/dto/invoice';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { type SuspenseOptions } from './helpers';
import { createOptimisticResource } from './mutation/resource';

export const invoiceQueries = {
	rootKey: () => ['invoices'] as const,

	listsKey: () => [...invoiceQueries.rootKey(), 'list'] as const,
	listKey: (clientId?: string) =>
		[...invoiceQueries.listsKey(), { client: clientId ?? null }] as const,
	list: (clientId?: string) =>
		queryOptions({
			queryKey: invoiceQueries.listKey(clientId),
			queryFn: ({ signal }) =>
				parseAPIRes(
					rpc.invoices.$get(
						{ query: { ...(clientId ? { client: clientId } : {}) } },
						{ init: { signal } },
					),
				),
		}),
};

const factory = createOptimisticResource<Invoice>({
	mutationKey: invoiceQueries.rootKey(),
	invalidates: () => [invoiceQueries.rootKey()],
});

type InvoicesResponse = InferResponseType<typeof rpc.invoices.$get, 200>;
type InvoiceOptions<TData> = SuspenseOptions<
	InvoicesResponse,
	ReturnType<typeof invoiceQueries.listKey>,
	TData
>;

const useOptimisticInvoiceQuery = <TData = InvoicesResponse>(
	clientId: string | undefined,
	options?: InvoiceOptions<TData>,
) => {
	const select = factory.useOptimisticSelect(
		(response, update) => ({
			...response,
			data: response.data.map(update),
		}),
		options?.select,
	);

	return useSuspenseQuery({ ...invoiceQueries.list(clientId), ...options, select });
};

export const useInvoices = <TData = InvoicesResponse>(options?: InvoiceOptions<TData>) =>
	useOptimisticInvoiceQuery(undefined, options);

export const useClientInvoices = <TData = InvoicesResponse>(
	clientId: string,
	options?: InvoiceOptions<TData>,
) => useOptimisticInvoiceQuery(clientId, options);

export const useInvoiceMutation = factory.useOptimisticMutation;
