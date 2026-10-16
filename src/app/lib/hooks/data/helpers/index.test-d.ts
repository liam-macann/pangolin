import { queryOptions } from '@tanstack/react-query';
import { describe, expectTypeOf, test } from 'vitest';

import { composeSelect } from './index';

describe('composeSelect', () => {
	const valueQuery = () =>
		queryOptions({
			queryKey: ['value'] as const,
			queryFn: async () => ({ value: 42 }),
			select: response => response.value,
		});

	test('Returns the merged selector output, or the original if only one selector is passed', () => {
		const { select: read } = valueQuery();

		expectTypeOf(composeSelect(read)).returns.toEqualTypeOf<number>();
		expectTypeOf(composeSelect(read, { select: undefined })).returns.toEqualTypeOf<number>();

		expectTypeOf(
			composeSelect(read, { select: value => value.toFixed() }),
		).returns.toEqualTypeOf<string>();

		expectTypeOf(
			composeSelect(read, { select: () => undefined }),
		).returns.toEqualTypeOf<undefined>();
	});

	test('Produces a union when a forwarded selector may be undefined', () => {
		const { select: read } = valueQuery();

		type Format = (value: number) => string;
		const composeForwarded = (select?: Format) => composeSelect(read, { select });

		expectTypeOf(composeForwarded).returns.returns.toEqualTypeOf<number | string>();
	});
});
