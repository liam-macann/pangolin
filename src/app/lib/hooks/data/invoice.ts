import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';

import rpc from '#rpc';
import { type Invoice } from '@/api/dto/invoice';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { composeSelect, type QueryOptions } from './helpers';
import { createOptimisticResource } from './mutation/resource';

export const invoiceQueries = {
	rootKey: () => ['invoices'] as const,

	listsKey: () => [...invoiceQueries.rootKey(), 'list'] as const,
	listKey: (clientId?: string) =>
		[...invoiceQueries.listsKey(), { client: clientId ?? null }] as const,
	list: (clientId?: string) =>
		queryOptions({
			queryKey: invoiceQueries.listKey(clientId),
			queryFn: ({ signal }) => parseAPIRes(rpc.invoices.$get({ query: {} }, { init: { signal } })),
			select: response => response.data,
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
	return useSuspenseQuery({
		...query,
		...options,
		select: factory.useOptimisticSelect(
			(response, update) => ({ ...response, data: response.data.map(update) }),
			composeSelect(select, options),
		),
	});
};

export const useInvoices = <TSelect>(options?: InvoiceListOptions<TSelect>) =>
	useInvoiceList(undefined, options);

export const useClientInvoices = <TSelect>(
	clientId: string,
	options?: InvoiceListOptions<TSelect>,
) => useInvoiceList(clientId, options);

export const useInvoiceMutation = factory.useOptimisticMutation;
