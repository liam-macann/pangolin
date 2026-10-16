import {
	type AnyUseInfiniteQueryOptions,
	type AnyUseQueryOptions,
	type UseSuspenseInfiniteQueryOptions,
	type UseSuspenseQueryOptions,
} from '@tanstack/react-query';

/** Object holding a selector over query data, captured as `TSelect`. */
export type SelectOptions<TSelect, TData> =
	// Select is required so that a forwarded selector keeps `undefined` type
	{ select: TSelect & (((data: TData) => unknown) | undefined) } | { select?: never };

/** Keys that must be specified in the query builder factory, not at call sites.
 * @remarks This ensures global cache behaviour is sound. */
type DefinitionKey =
	| 'getNextPageParam'
	| 'getPreviousPageParam'
	| 'initialPageParam'
	| 'maxPages'
	| 'queryFn'
	| 'queryKey';

/** Call-site options of a query hook, where query definitions own the key and fetcher. */
type HookOptions<TOptions, TData, S> = Partial<Omit<TOptions, DefinitionKey | 'select'>> &
	SelectOptions<S, TData>;

/** Caller-supplied options for a suspense query hook over a query definition factory. */
// biome-ignore format: Keep line intact
export type QueryOptions<TQuery extends (...args: never) => QueryDefinition, S> =
	ReturnType<TQuery> extends UseSuspenseInfiniteQueryOptions<
		infer TQueryFnData,
		infer TError,
		infer TData,
		infer TQueryKey,
		infer TPageParam
	>
		? HookOptions<UseSuspenseInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>, TData, S>
		: ReturnType<TQuery> extends UseSuspenseQueryOptions<
					infer TQueryFnData,
					infer TError,
					infer TData,
					infer TQueryKey
				>
			? HookOptions<UseSuspenseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, TData, S>
			: never;

export type QueryDefinition = AnyUseQueryOptions | AnyUseInfiniteQueryOptions;
