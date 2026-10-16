import { type DefaultError, queryOptions, useSuspenseQuery } from '@tanstack/react-query';

import rpc from '#rpc';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { composeSelect, type QueryOptions } from './helpers';
import { type MutationOptions, useInvalidatingMutation } from './mutation/invalidate';

export const configQueries = {
	rootKey: () => ['config'] as const,

	currentKey: () => [...configQueries.rootKey(), 'current'] as const,
	current: () =>
		queryOptions({
			queryKey: configQueries.currentKey(),
			queryFn: ({ signal }) => parseAPIRes(rpc.config.$get({}, { init: { signal } })),
			select: response => response.data,
		}),
};

export const useConfig = <S>(options?: QueryOptions<typeof configQueries.current, S>) => {
	const { select, ...query } = configQueries.current();
	return useSuspenseQuery({ ...query, ...options, select: composeSelect(select, options) });
};

export const useConfigMutation = <TData = unknown, TError = DefaultError, TVariables = void>(
	options: MutationOptions<TData, TError, TVariables>,
) => useInvalidatingMutation({ ...options, invalidates: [configQueries.rootKey()] });
