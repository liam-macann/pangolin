import { type DefaultError, type UseSuspenseQueryOptions } from '@tanstack/react-query';

export * from './define';

/** Omits the props that bind a query to an entity, which are always defined in our entity hooks. */
export type QueryOptionsFor<TResponse, TData = TResponse> = Omit<
	UseSuspenseQueryOptions<TResponse, DefaultError, TData>,
	'queryFn' | 'queryKey'
>;
