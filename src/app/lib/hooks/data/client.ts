'use client';

import {
	type DefaultError,
	type QueryFunctionContext,
	type UseMutationOptions,
	useMutation,
	useSuspenseQuery,
} from '@tanstack/react-query';

import { type Client } from '@/api/dto/client';
import { client } from '@/lib/api';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import {
	type EntityResponse,
	invalidateKeys,
	type ListResponse,
	type QueryOptionsFor,
	withInvalidation,
} from './helper';

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

function clientsQuery() {
	return {
		queryKey: clientKeys.list(),
		queryFn: ({ signal }: QueryFunctionContext) =>
			parseAPIRes(client.clients.$get({ query: {} }, { init: { signal } })),
	};
}

function clientQuery(id: string) {
	return {
		queryKey: clientKeys.detail(id),
		queryFn: ({ signal }: QueryFunctionContext) =>
			parseAPIRes(client.clients[':id'].$get({ param: { id } }, { init: { signal } })),
	};
}

export const useClients = <TData = ListResponse<Client>>(
	options?: QueryOptionsFor<ListResponse<Client>, TData>,
) => useSuspenseQuery({ ...clientsQuery(), ...options });

export const useClient = <TData = EntityResponse<Client>>(
	id: string,
	options?: QueryOptionsFor<EntityResponse<Client>, TData>,
) => useSuspenseQuery({ ...clientQuery(id), ...options });

export function useClientMutation<
	TData = unknown,
	TError = DefaultError,
	TVariables = void,
	TOnMutateResult = unknown,
>(
	clientId: string | undefined,
	options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
) {
	return useMutation(
		withInvalidation(options, queryClient =>
			invalidateKeys(queryClient, affectedClientKeys(clientId)),
		),
	);
}
