'use client';

import {
	type DefaultError,
	QueryClient,
	QueryClientProvider,
	type QueryKey,
	type UseMutationOptions,
	type UseSuspenseQueryOptions,
} from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '@/lib/auth';
import { useIsomorphicLayoutEffect, usePrevious } from '@/lib/hooks';

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [client] = useState(() => new QueryClient());

	const { data: session } = useSession();
	const userId = session?.user.id ?? null;

	const previous = usePrevious(userId);

	useIsomorphicLayoutEffect(() => {
		if (previous !== null && previous !== userId) client.clear();
	}, [client, previous, userId]);

	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export type EntityResponse<T> = { data: T };
export const toEntityResponse = <T,>(data: T): EntityResponse<T> => ({ data });

export type ListResponse<T> = {
	data: T[];
	meta: {
		total: number;
		limit: number | undefined;
		offset: number | undefined;
	};
};

/** Keeps existing server-provided arrays usable while the query refreshes immediately. */
export function envelopeWrapper<T>(data: T[]): ListResponse<T> {
	return { data, meta: { total: data.length, limit: 200, offset: undefined } };
}

export type QueryInvalidator = Pick<QueryClient, 'invalidateQueries'>;
export const invalidateKeys = (queryClient: QueryInvalidator, queryKeys: readonly QueryKey[]) =>
	Promise.all(queryKeys.map(queryKey => queryClient.invalidateQueries({ queryKey })));

/** Omits the props that bind a query to an entity, which are always defined in our entity hooks */
export type QueryOptionsFor<TResponse, TData = TResponse> = Omit<
	UseSuspenseQueryOptions<TResponse, DefaultError, TData>,
	'queryFn' | 'queryKey'
>;

/** Runs onSuccess callback, then invalidates derived queries */
export function withInvalidation<TData, TError, TVariables, TOnMutateResult>(
	options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
	invalidate: (queryClient: QueryClient, variables: TVariables) => unknown,
): UseMutationOptions<TData, TError, TVariables, TOnMutateResult> {
	return {
		...options,
		onSuccess: async (data, variables, onMutateResult, context, ...args) => {
			await options.onSuccess?.(data, variables, onMutateResult, context, ...args);
			await invalidate(context.client, variables);
		},
	};
}
