import {
	infiniteQueryOptions,
	type QueryFunctionContext,
	type QueryKey,
	useSuspenseInfiniteQuery,
} from '@tanstack/react-query';
import { type InferRequestType } from 'hono/client';

import rpc from '#rpc';
import { type Invoice } from '@/api/dto/invoice';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { composeSelect, type PageParam, type QueryOptions, updatePages } from './helpers';
import { createOptimisticResource } from './mutation/resource';

export type InvoiceListParams = Pick<
	InferRequestType<typeof rpc.invoices.$get>['query'],
	'client' | 'sort'
>;

/** Most recently issued first, matching the API default. */
export const DEFAULT_INVOICE_SORT = ['-issuedAt'] satisfies InvoiceListParams['sort'];
export const INVOICE_PAGE_SIZE = 40;

export const invoiceQueries = {
	rootKey: () => ['invoices'] as const,

	listsKey: () => [...invoiceQueries.rootKey(), 'list'] as const,
	listKey: ({ client, sort = DEFAULT_INVOICE_SORT }: InvoiceListParams = {}) =>
		[
			...invoiceQueries.listsKey(),
			{ client: client ?? null, sort, limit: INVOICE_PAGE_SIZE },
		] as const,
	list: (params: InvoiceListParams = {}) =>
		infiniteQueryOptions({
			queryKey: invoiceQueries.listKey(params),
			queryFn: ({ pageParam, signal }: QueryFunctionContext<QueryKey, PageParam>) =>
				parseAPIRes(
					rpc.invoices.$get(
						{
							query: {
								...(params.client ? { client: params.client } : {}),
								sort: params.sort ?? DEFAULT_INVOICE_SORT,
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
	params: InvoiceListParams,
	options?: InvoiceListOptions<TSelect>,
) => {
	const { select, ...query } = invoiceQueries.list(params);
	return useSuspenseInfiniteQuery({
		...query,
		...options,
		select: factory.useOptimisticSelect(updatePages, composeSelect(select, options)),
	});
};

export const useInvoices = <TSelect>({
	params = {},
	...options
}: InvoiceListOptions<TSelect> & { params?: InvoiceListParams } = {}) =>
	useInvoiceList(params, options);

export const useClientInvoices = <TSelect>(
	clientId: string,
	options?: InvoiceListOptions<TSelect>,
) => useInvoiceList({ client: clientId }, options);

export const useInvoiceMutation = factory.useOptimisticMutation;
