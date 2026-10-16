import { type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { type Cursor } from '@/api/pagination/cursor';

import { type QueryDefinition, type SelectOptions } from './options';

export * from './infinite';
export type { QueryDefinition, QueryOptions } from './options';

/** Page parameter of a cursor-paginated query, which starts without a cursor. */
export type PageParam = Cursor | null;

/** Composes an optional selector after another selector.
 *  @returns A merged selector, allowing callers to project over a selected query. */
export function composeSelect<TResponse, TData, TSelect>(
	read: ((response: TResponse) => TData) | undefined,
	options?: SelectOptions<TSelect, NoInfer<TData>>,
): (response: TResponse) => TSelect extends (data: never) => infer R ? R : TData;

export function composeSelect<TResponse, TData>(
	read: ((response: TResponse) => TData) | undefined,
	options?: { select?: (data: TData | TResponse) => unknown },
) {
	return (response: TResponse) => {
		const data = read ? read(response) : response;
		return options?.select ? options.select(data) : data;
	};
}

/** Applies a callback over every entity in the loaded pages of an infinite query response. */
export const updatePages = <TPage extends { data: TEntity[] }, TPageParam, TEntity>(
	res: InfiniteData<TPage, TPageParam>,
	update: (entity: TEntity) => TEntity,
) => ({ ...res, pages: res.pages.map(page => ({ ...page, data: page.data.map(update) })) });

/** Starts a query without exposing an (in)finite distinction to callers. */
export const prefetch = async (queryClient: QueryClient, query: QueryDefinition): Promise<void> => {
	const options = { ...query, select: undefined }; // Discard select, as projections are not necessary for prefetches

	if ('initialPageParam' in options) await queryClient.infiniteQuery(options);
	else await queryClient.query(options);
};
