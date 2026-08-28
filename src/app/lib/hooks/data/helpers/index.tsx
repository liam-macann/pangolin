import {
	type AnyUseInfiniteQueryOptions,
	type AnyUseQueryOptions,
	type DefaultError,
	type InfiniteData,
	type QueryClient,
	type QueryKey,
	type UseSuspenseInfiniteQueryOptions,
	type UseSuspenseQueryOptions,
} from '@tanstack/react-query';

export type QueryDefinition = AnyUseQueryOptions | AnyUseInfiniteQueryOptions;

export type SuspenseOptions<TResponse, TQueryKey extends QueryKey, TData = TResponse> = Omit<
	UseSuspenseQueryOptions<TResponse, DefaultError, TData, TQueryKey>,
	'queryFn' | 'queryKey'
>;

export type SuspenseInfiniteOptions<
	TResponse,
	TQueryKey extends QueryKey,
	TPageParam,
	TData = InfiniteData<TResponse, TPageParam>,
> = Omit<
	UseSuspenseInfiniteQueryOptions<TResponse, DefaultError, TData, TQueryKey, TPageParam>,
	'getNextPageParam' | 'initialPageParam' | 'queryFn' | 'queryKey'
>;

const isInfiniteQuery = (query: QueryDefinition): query is AnyUseInfiniteQueryOptions =>
	'initialPageParam' in query;

/** Starts a query without exposing a finite/infinite distinction to callers */
export const prefetch = (queryClient: QueryClient, query: QueryDefinition) =>
	isInfiniteQuery(query) ? queryClient.infiniteQuery(query) : queryClient.query(query);
