import {
	type DefaultError,
	type QueryFunctionContext,
	useSuspenseQuery,
} from '@tanstack/react-query';
import { type InferResponseType } from 'hono/client';

import rpc from '#rpc';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { declareQueries, type QueryOptionsFor } from './helpers';
import { type MutationOptions, useInvalidatingMutation } from './mutation';

const configRoot = ['config'] as const;
type ConfigResponse = InferResponseType<typeof rpc.config.$get, 200>;

export const configQueries = declareQueries({
	current: () => ({
		queryKey: [...configRoot, 'current'] as const,
		queryFn: ({ signal }: QueryFunctionContext) =>
			parseAPIRes(rpc.config.$get({}, { init: { signal } })),
	}),
});

export const useConfig = <TData = ConfigResponse>(
	options?: QueryOptionsFor<ConfigResponse, TData>,
) => useSuspenseQuery({ ...configQueries.current(), ...options });

export const useConfigMutation = <TData = unknown, TError = DefaultError, TVariables = void>(
	options: MutationOptions<TData, TError, TVariables>,
) => useInvalidatingMutation(options, [configRoot]);
