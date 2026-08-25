'use client';

import {
	type DefaultError,
	type QueryFunctionContext,
	type UseMutationOptions,
	useMutation,
	useSuspenseQuery,
} from '@tanstack/react-query';

import { type Config } from '@/api/dto/config';
import { client } from '@/lib/api';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import {
	type EntityResponse,
	invalidateKeys,
	type QueryOptionsFor,
	withInvalidation,
} from './helper';

export const configKeys = {
	all: ['config'] as const,
	current: () => ['config', 'current'] as const,
};

function configQuery() {
	return {
		queryKey: configKeys.current(),
		queryFn: ({ signal }: QueryFunctionContext) =>
			parseAPIRes(client.config.$get({}, { init: { signal } })),
	};
}

export const useConfig = <TData = EntityResponse<Config>>(
	options?: QueryOptionsFor<EntityResponse<Config>, TData>,
) => useSuspenseQuery({ ...configQuery(), ...options });

export function useConfigMutation<
	TData = unknown,
	TError = DefaultError,
	TVariables = void,
	TOnMutateResult = unknown,
>(options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult>) {
	return useMutation(
		withInvalidation(options, queryClient => invalidateKeys(queryClient, [configKeys.all])),
	);
}
