import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { describe, expectTypeOf, test } from 'vitest';

import { type QueryOptions } from './index';

const valueQuery = () =>
	queryOptions({
		queryKey: ['value'] as const,
		queryFn: async () => ({ value: 42 }),
		select: response => response.value,
	});

const infiniteQuery = () =>
	infiniteQueryOptions({
		queryKey: ['numbers'] as const,
		queryFn: async () => ({ values: [1, 2] }),
		initialPageParam: 0,
		getNextPageParam: () => undefined,
		select: response => response.pages.flatMap(page => page.values),
	});

// Stand-in for hooks over each query, allowing us to access the captured selector type
declare function useValue<TSelect>(options?: QueryOptions<typeof valueQuery, TSelect>): TSelect;
declare function useList<TSelect>(options?: QueryOptions<typeof infiniteQuery, TSelect>): TSelect;

type Format = (value: number) => string;

describe('QueryOptions', () => {
	test('Captures the caller selector, if any', () => {
		expectTypeOf(useValue()).toBeUnknown();
		expectTypeOf(useValue({})).toBeUnknown();
		expectTypeOf(useValue({ select: undefined })).toBeUndefined();
		expectTypeOf(useValue({ select: value => value.toFixed() })).toEqualTypeOf<Format>();
	});

	test('Passes the data selected by the query definition to the caller selector', () => {
		useValue({ select: value => expectTypeOf(value).toEqualTypeOf<number>() });
		useList({ select: values => expectTypeOf(values).toEqualTypeOf<number[]>() });

		// @ts-expect-error The selector reads the query data, not the response
		useValue({ select: (response: { value: number }) => response.value });
	});

	test('Produces a union when a forwarded selector may be undefined', () => {
		const useForwarded = (select?: Format) => useValue({ select });
		const useForwardedOptions = (options?: { select?: Format }) => useValue(options);

		expectTypeOf(useForwarded).returns.toEqualTypeOf<Format | undefined>();
		expectTypeOf(useForwardedOptions).returns.toEqualTypeOf<Format | undefined>();

		// Known gap: Inference strips `undefined` from a required selector on an optional argument.
		// Select must be declared optional when forwarded.
		const useOptionalOptions = (options?: { select: Format }) => useValue(options);

		// @ts-expect-error This should be a union type, as options may be omitted at runtime. Known gap.
		expectTypeOf(useOptionalOptions).returns.toEqualTypeOf<Format | undefined>();
	});

	test('Rejects options owned by the query definition', () => {
		// Overriding these values at call sites would corrupt the global cache

		// @ts-expect-error The query definition owns its key
		useValue({ queryKey: ['other'] });
		// @ts-expect-error The query definition owns its query function
		useValue({ queryFn: async () => ({ value: 0 }) });

		// @ts-expect-error The query definition owns its first page
		useList({ initialPageParam: 1 });
		// @ts-expect-error The query definition owns its next page
		useList({ getNextPageParam: () => undefined });
		// @ts-expect-error The query definition owns its previous page
		useList({ getPreviousPageParam: () => undefined });
		// @ts-expect-error The query definition owns how many pages it keeps
		useList({ maxPages: 1 });
	});
});
