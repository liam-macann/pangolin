import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';

import rpc from '#rpc';
import { type Client } from '@/api/dto/client';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { composeSelect, type QueryOptions } from './helpers';
import { createOptimisticResource } from './mutation/resource';

export const clientQueries = {
	rootKey: () => ['clients'] as const,

	listsKey: () => [...clientQueries.rootKey(), 'list'] as const,
	listKey: () => [...clientQueries.listsKey()] as const,
	list: () =>
		queryOptions({
			queryKey: clientQueries.listKey(),
			queryFn: ({ signal }) => parseAPIRes(rpc.clients.$get({ query: {} }, { init: { signal } })),
			select: response => response.data,
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

export const useClients = <TSelect>(options?: QueryOptions<typeof clientQueries.list, TSelect>) => {
	const { select, ...query } = clientQueries.list();
	return useSuspenseQuery({
		...query,
		...options,
		select: factory.useOptimisticSelect(
			(response, update) => ({ ...response, data: response.data.map(update) }),
			composeSelect(select, options),
		),
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
