import { type InferResponseType } from 'hono/client';

import rpc from '#rpc';
import { type Client } from '@/api/dto/client';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { declareQueries, type QueryOptionsFor } from './helpers';
import { createOptimisticResource } from './mutation';

export const clientKeys = {
	all: ['clients'] as const,
	lists: () => ['clients', 'list'] as const,
	list: () => ['clients', 'list', {}] as const,
	detail: (id: string) => ['clients', 'detail', id] as const,
};

export const clientQueries = declareQueries({
	list: () => ({
		queryKey: clientKeys.list(),
		queryFn: ({ signal }) => parseAPIRes(rpc.clients.$get({ query: {} }, { init: { signal } })),
	}),
	detail: (id: string) => ({
		queryKey: clientKeys.detail(id),
		queryFn: ({ signal }) =>
			parseAPIRes(rpc.clients[':id'].$get({ param: { id } }, { init: { signal } })),
	}),
});

const affectedClientKeys = (clientId: string | undefined) => [
	clientKeys.lists(),
	...(clientId === undefined ? [] : [clientKeys.detail(clientId)]),
];
const factory = createOptimisticResource<Client>({
	mutationKey: clientKeys.all,
	invalidates: affectedClientKeys,
});

type ClientsResponse = InferResponseType<typeof rpc.clients.$get, 200>;
type ClientResponse = InferResponseType<(typeof rpc.clients)[':id']['$get'], 200>;

export const useClients = <TData = ClientsResponse>(
	options?: QueryOptionsFor<ClientsResponse, TData>,
) =>
	factory.useOptimisticQuery(
		{ ...clientQueries.list(), ...options },
		// Optimistic patcher
		(response, update) => ({ ...response, data: response.data.map(update) }),
	);

export const useClient = <TData = ClientResponse>(
	id: string,
	options?: QueryOptionsFor<ClientResponse, TData>,
) =>
	factory.useOptimisticQuery(
		{ ...clientQueries.detail(id), ...options },
		// Optimistic patcher
		(response, update) => ({ ...response, data: update(response.data) }),
	);

export const useClientMutation = factory.useOptimisticMutation;
