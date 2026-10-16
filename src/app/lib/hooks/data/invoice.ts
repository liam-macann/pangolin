import {
	infiniteQueryOptions,
	type QueryFunctionContext,
	type QueryKey,
	useSuspenseInfiniteQuery,
} from '@tanstack/react-query';

import rpc from '#rpc';
import { type Invoice } from '@/api/dto/invoice';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { composeSelect, type PageParam, type QueryOptions, updatePages } from './helpers';
import { createOptimisticResource } from './mutation/resource';

export const INVOICE_PAGE_SIZE = 100;

export const invoiceQueries = {
	rootKey: () => ['invoices'] as const,

	listsKey: () => [...invoiceQueries.rootKey(), 'list'] as const,
	listKey: (clientId?: string) =>
		[...invoiceQueries.listsKey(), { client: clientId ?? null, limit: INVOICE_PAGE_SIZE }] as const,
	list: (clientId?: string) =>
		infiniteQueryOptions({
			queryKey: invoiceQueries.listKey(clientId),
			queryFn: ({ pageParam, signal }: QueryFunctionContext<QueryKey, PageParam>) =>
				parseAPIRes(
					rpc.invoices.$get(
						{
							query: {
								...(clientId ? { client: clientId } : {}),
								limit: String(INVOICE_PAGE_SIZE),
								...(pageParam ? { cursor: pageParam } : {}),
							},
						},
						{ init: { signal } },
					),
				),
			initialPageParam: null,
			getNextPageParam: lastPage => lastPage.meta.nextCursor,
			select: response => response.pages.flatMap(page => page.data),
		}),
};

const factory = createOptimisticResource<Invoice>({
	mutationKey: invoiceQueries.rootKey(),
	invalidates: () => [invoiceQueries.rootKey()],
});

type InvoiceListOptions<TSelect> = QueryOptions<typeof invoiceQueries.list, TSelect>;

const useInvoiceList = <TSelect>(
	clientId: string | undefined,
	options?: InvoiceListOptions<TSelect>,
) => {
	const { select, ...query } = invoiceQueries.list(clientId);
	return useSuspenseInfiniteQuery({
		...query,
		...options,
		select: factory.useOptimisticSelect(updatePages, composeSelect(select, options)),
	});
};

export const useInvoices = <TSelect>(options?: InvoiceListOptions<TSelect>) =>
	useInvoiceList(undefined, options);

export const useClientInvoices = <TSelect>(
	clientId: string,
	options?: InvoiceListOptions<TSelect>,
) => useInvoiceList(clientId, options);

export const useInvoiceMutation = factory.useOptimisticMutation;
