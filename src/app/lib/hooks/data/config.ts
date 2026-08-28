import { type DefaultError, queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { type InferResponseType } from 'hono/client';

import rpc from '#rpc';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { type SuspenseOptions } from './helpers';
import { type MutationOptions, useInvalidatingMutation } from './mutation/invalidate';

export const configQueries = {
	rootKey: () => ['config'] as const,

	currentKey: () => [...configQueries.rootKey(), 'current'] as const,
	current: () =>
		queryOptions({
			queryKey: configQueries.currentKey(),
			queryFn: ({ signal }) => parseAPIRes(rpc.config.$get({}, { init: { signal } })),
		}),
};

type ConfigResponse = InferResponseType<typeof rpc.config.$get, 200>;
type ConfigOptions<TData> = SuspenseOptions<
	ConfigResponse,
	ReturnType<typeof configQueries.currentKey>,
	TData
>;

export const useConfig = <TData = ConfigResponse>(options?: ConfigOptions<TData>) =>
	useSuspenseQuery({ ...configQueries.current(), ...options, select: options?.select });

export const useConfigMutation = <TData = unknown, TError = DefaultError, TVariables = void>(
	options: MutationOptions<TData, TError, TVariables>,
) => useInvalidatingMutation({ ...options, invalidates: [configQueries.rootKey()] });
