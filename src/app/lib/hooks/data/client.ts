import {
	infiniteQueryOptions,
	type QueryFunctionContext,
	type QueryKey,
	queryOptions,
	useSuspenseInfiniteQuery,
	useSuspenseQuery,
} from '@tanstack/react-query';

import rpc from '#rpc';
import { type Client } from '@/api/dto/client';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { composeSelect, type PageParam, type QueryOptions, updatePages } from './helpers';
import { createOptimisticResource } from './mutation/resource';

export const CLIENT_PAGE_SIZE = 100;

type ClientListParams = {
	/** Whether to list only favorites, or only clients that are not. */
	favorite?: boolean;
};

export const clientQueries = {
	rootKey: () => ['clients'] as const,

	listsKey: () => [...clientQueries.rootKey(), 'list'] as const,
	listKey: ({ favorite }: ClientListParams = {}) =>
		[...clientQueries.listsKey(), { favorite: favorite ?? null, limit: CLIENT_PAGE_SIZE }] as const,
	list: (params: ClientListParams = {}) =>
		infiniteQueryOptions({
			queryKey: clientQueries.listKey(params),
			queryFn: ({ pageParam, signal }: QueryFunctionContext<QueryKey, PageParam>) =>
				parseAPIRes(
					rpc.clients.$get(
						{
							query: {
								...(params.favorite !== undefined && { favorite: String(params.favorite) }),
								limit: String(CLIENT_PAGE_SIZE),
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

	detailsKey: () => [...clientQueries.rootKey(), 'detail'] as const,
	detailKey: (id: string) => [...clientQueries.detailsKey(), id] as const,
	detail: (id: string) =>
		queryOptions({
			queryKey: clientQueries.detailKey(id),
			queryFn: ({ signal }) =>
				parseAPIRes(rpc.clients[':id'].$get({ param: { id } }, { init: { signal } })),
			select: response => response.data,
		}),
};

const affectedClientKeys = (clientId: string | undefined) => [
	clientQueries.listsKey(),
	...(clientId === undefined ? [] : [clientQueries.detailKey(clientId)]),
];
const factory = createOptimisticResource<Client>({
	mutationKey: clientQueries.rootKey(),
	invalidates: affectedClientKeys,
});

export const useClients = <TSelect>({
	params = {},
	...options
}: QueryOptions<typeof clientQueries.list, TSelect> & { params?: ClientListParams } = {}) => {
	const { select, ...query } = clientQueries.list(params);
	return useSuspenseInfiniteQuery({
		...query,
		...options,
		select: factory.useOptimisticSelect(updatePages, composeSelect(select, options)),
	});
};

export const useClient = <TSelect>(
	id: string,
	options?: QueryOptions<typeof clientQueries.detail, TSelect>,
) => {
	const { select, ...query } = clientQueries.detail(id);
	return useSuspenseQuery({
		...query,
		...options,
		select: factory.useOptimisticSelect(
			(response, update) => ({ ...response, data: update(response.data) }),
			composeSelect(select, options),
		),
	});
};

export const useClientMutation = factory.useOptimisticMutation;
