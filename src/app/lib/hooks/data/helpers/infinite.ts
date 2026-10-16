'use client';

import { type UseSuspenseInfiniteQueryResult } from '@tanstack/react-query';
import { type PaginationState } from '@tanstack/react-table';
import { type RefObject, useEffect } from 'react';

/** The handles on an infinite query result that access the next page. */
type NextPage = Pick<
	UseSuspenseInfiniteQueryResult,
	'fetchNextPage' | 'hasNextPage' | 'isFetchingNextPage' | 'isFetchNextPageError'
>;

/** Fetch one page after another, for as long as more items are needed.
 * @param condition Evaluated after every render.
 * @remarks Stops at the last page, or once a fetch fails. */
export function useFetchWhile(
	{ fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError }: NextPage,
	condition: boolean | (() => boolean),
) {
	// Each settled fetch triggers a re-render, so condition is checked again against new page
	useEffect(() => {
		if (!hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
		if (typeof condition === 'function' ? condition() : condition)
			// Joins a fetch already in flight, rather than restarting it
			void fetchNextPage({ cancelRefetch: false });
	});
}

/** Fetch one page after another while the end of a scroll area is in view.
 * @param condition A gate to disable the query.
 * @returns A scroll handler for the list. */
export function useFetchNearEnd(
	query: NextPage,
	ref: RefObject<HTMLElement | null>,
	condition: boolean | (() => boolean) = true,
) {
	const nearEnd = (el: HTMLElement, threshold = 160) =>
		el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;

	const needsMore = () =>
		typeof condition === 'function'
			? condition()
			: condition && !!ref.current && nearEnd(ref.current);

	useFetchWhile(query, needsMore);

	return () => {
		if (query.hasNextPage && needsMore()) void query.fetchNextPage({ cancelRefetch: false });
	};
}

/** Fetch more items a page ahead of when they are needed.
 * @remarks Repeats as rows arrive, so landing on a later page loads every page up to it. */
export const useFetchAhead = (
	query: NextPage,
	/** How many entities the table can page over. */
	availableCount: number,
	{ pageIndex, pageSize }: PaginationState,
) => useFetchWhile(query, (pageIndex + 2) * pageSize > availableCount);
