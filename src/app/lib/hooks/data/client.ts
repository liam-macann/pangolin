import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { type InferResponseType } from 'hono/client';

import rpc from '#rpc';
import { type Client } from '@/api/dto/client';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { type SuspenseOptions } from './helpers';
import { createOptimisticResource } from './mutation/resource';

export const clientQueries = {
	rootKey: () => ['clients'] as const,

	listsKey: () => [...clientQueries.rootKey(), 'list'] as const,
	listKey: () => [...clientQueries.listsKey(), {}] as const,
	list: () =>
		queryOptions({
			queryKey: clientQueries.listKey(),
			queryFn: ({ signal }) => parseAPIRes(rpc.clients.$get({ query: {} }, { init: { signal } })),
		}),

	detailsKey: () => [...clientQueries.rootKey(), 'detail'] as const,
	detailKey: (id: string) => [...clientQueries.detailsKey(), id] as const,
	detail: (id: string) =>
		queryOptions({
			queryKey: clientQueries.detailKey(id),
			queryFn: ({ signal }) =>
				parseAPIRes(rpc.clients[':id'].$get({ param: { id } }, { init: { signal } })),
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

type ClientsResponse = InferResponseType<typeof rpc.clients.$get, 200>;
type ClientResponse = InferResponseType<(typeof rpc.clients)[':id']['$get'], 200>;
type ClientsOptions<TData> = SuspenseOptions<
	ClientsResponse,
	ReturnType<typeof clientQueries.listKey>,
	TData
>;
type ClientOptions<TData> = SuspenseOptions<
	ClientResponse,
	ReturnType<typeof clientQueries.detailKey>,
	TData
>;

export const useClients = <TData = ClientsResponse>(options?: ClientsOptions<TData>) => {
	const select = factory.useOptimisticSelect(
		(response, update) => ({ ...response, data: response.data.map(update) }),
		options?.select,
	);

	return useSuspenseQuery({ ...clientQueries.list(), ...options, select });
};

export const useClient = <TData = ClientResponse>(id: string, options?: ClientOptions<TData>) => {
	const select = factory.useOptimisticSelect(
		(response, update) => ({ ...response, data: update(response.data) }),
		options?.select,
	);

	return useSuspenseQuery({ ...clientQueries.detail(id), ...options, select });
};

export const useClientMutation = factory.useOptimisticMutation;
