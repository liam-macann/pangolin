'use client';

import { type QueryFunctionContext } from '@tanstack/react-query';

import rpc from '#rpc';
import { type Client } from '@/api/dto/client';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { type EntityResponse, type ListResponse, type QueryOptionsFor } from './helper';
import { createOptimisticResource } from './mutation';

export const clientKeys = {
	all: ['clients'] as const,
	lists: () => ['clients', 'list'] as const,
	list: () => ['clients', 'list', {}] as const,
	detail: (id: string) => ['clients', 'detail', id] as const,
};

const affectedClientKeys = (clientId: string | undefined) => [
	clientKeys.lists(),
	...(clientId === undefined ? [] : [clientKeys.detail(clientId)]),
];
const factory = createOptimisticResource<Client>({
	mutationKey: clientKeys.all,
	invalidates: affectedClientKeys,
});

type ClientsResponse = ListResponse<Client>;
type ClientResponse = EntityResponse<Client>;

export function useClients<TData = ClientsResponse>(
	options?: QueryOptionsFor<ClientsResponse, TData>,
) {
	return factory.useOptimisticQuery(
		{
			queryKey: clientKeys.list(),
			queryFn: ({ signal }: QueryFunctionContext) =>
				parseAPIRes(rpc.clients.$get({ query: {} }, { init: { signal } })),
			...options,
		},
		(response, update) => ({ ...response, data: response.data.map(update) }),
	);
}

export function useClient<TData = ClientResponse>(
	id: string,
	options?: QueryOptionsFor<ClientResponse, TData>,
) {
	return factory.useOptimisticQuery(
		{
			queryKey: clientKeys.detail(id),
			queryFn: ({ signal }: QueryFunctionContext) =>
				parseAPIRes(rpc.clients[':id'].$get({ param: { id } }, { init: { signal } })),
			...options,
		},
		(response, update) => ({ ...response, data: update(response.data) }),
	);
}

export const useClientMutation = factory.useOptimisticMutation;
