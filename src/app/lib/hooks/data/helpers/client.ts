import {
	defaultShouldDehydrateQuery,
	environmentManager,
	QueryClient,
} from '@tanstack/react-query';

export function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			// Keep SSR-dehydrated data fresh briefly so components don't refetch on hydration
			queries: { staleTime: 60_000 },

			dehydrate: {
				// Include pending queries in dehydration
				shouldDehydrateQuery: query =>
					defaultShouldDehydrateQuery(query) || query.state.status === 'pending',

				// We should not catch Next.js server errors as that's how Next.js detects dynamic pages
				shouldRedactErrors: () => false,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
	// Server: always make a new query client
	if (environmentManager.isServer()) return makeQueryClient();

	browserQueryClient ??= makeQueryClient();
	return browserQueryClient;
}
