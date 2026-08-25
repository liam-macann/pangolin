'use client';

import {
	type DefaultError,
	type QueryFunctionContext,
	useSuspenseQuery,
} from '@tanstack/react-query';

import { type Config } from '@/api/dto/config';
import { client } from '@/lib/api';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { type EntityResponse, type QueryOptionsFor } from './helper';
import { type MutationOptions, useInvalidatingMutation } from './mutation';

export const configKeys = {
	all: ['config'] as const,
	current: () => ['config', 'current'] as const,
};

export const useConfig = <TData = EntityResponse<Config>>(
	options?: QueryOptionsFor<EntityResponse<Config>, TData>,
) =>
	useSuspenseQuery({
		queryKey: configKeys.current(),
		queryFn: ({ signal }: QueryFunctionContext) =>
			parseAPIRes(client.config.$get({}, { init: { signal } })),
		...options,
	});

export function useConfigMutation<TData = unknown, TError = DefaultError, TVariables = void>(
	options: MutationOptions<TData, TError, TVariables>,
) {
	return useInvalidatingMutation(options, [configKeys.all]);
}
