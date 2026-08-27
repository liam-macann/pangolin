import { type DefaultError, type UseSuspenseQueryOptions } from '@tanstack/react-query';

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

/** Omits the props that bind a query to an entity, which are always defined in our entity hooks. */
export type QueryOptionsFor<TResponse, TData = TResponse> = Omit<
	UseSuspenseQueryOptions<TResponse, DefaultError, TData>,
	'queryFn' | 'queryKey'
>;
