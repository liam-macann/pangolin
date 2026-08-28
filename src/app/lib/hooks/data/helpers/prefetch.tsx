import 'server-only';

import { dehydrate, HydrationBoundary, noop } from '@tanstack/react-query';
import { io } from 'next/cache';

import { makeQueryClient } from './client';
import { prefetch, type QueryDefinition } from './index';

/** PrefetchQuery initiates server-side fetches, and dehydrates to populate the client-side cache.
 * This allows us to parallelize, and avoid Suspense waterfalls in nested components.
 *
 * @remarks Deferred queries stream through the nearest Suspense boundary; only blocking queries block rendering
 */
export async function PrefetchQuery({
	children,
	queries = [],
	blocking = [],
}: {
	children: React.ReactNode;
	queries?: readonly QueryDefinition[];
	blocking?: readonly QueryDefinition[];
}) {
	const queryClient = makeQueryClient();

	queries.forEach(query => void prefetch(queryClient, query).catch(noop));

	// Await blocking queries, forcing component to suspend
	await Promise.all(blocking.map(query => prefetch(queryClient, query)));

	await io();
	return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
