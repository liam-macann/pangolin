import { type AnyUseSuspenseQueryOptions, queryOptions } from '@tanstack/react-query';
import { mapValues } from 'es-toolkit';

/** Type of {@link queryOptions} input, with selectors forbidden */
type SharedQueryOptions = Omit<AnyUseSuspenseQueryOptions, 'select'> & { select?: never };
type QueryFactory = (...args: never[]) => SharedQueryOptions;

/**
 * Helper to builds a query-options map for an entity. Pass the result to a useSuspenseQuery hook.
 * @remarks Passing `select` on any entry is a type error — transforms belong on the consuming hook
 */
export function declareQueries<TMap extends Record<string, QueryFactory>>(
	map: TMap,
): { [K in keyof TMap]: (...args: Parameters<TMap[K]>) => ReturnType<TMap[K]> };

export function declareQueries(map: Record<string, QueryFactory>) {
	return mapValues(
		map,
		factory =>
			(...args: Parameters<typeof factory>) =>
				queryOptions(factory(...args)),
	);
}
