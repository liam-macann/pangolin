import { toMerged } from 'es-toolkit/object';
import { mutate as globalMutate } from 'swr';
import { assert, beforeEach, describe, expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { type DeepPartial } from '@/lib/utils';

import { createMutation, detail, type GangedMutator, list } from './mutator-factory';

type Item = { id: string; label: string; flag: boolean };

const itemBuilder = (id: string, overrides?: DeepPartial<Item>): Item =>
	toMerged({ id, label: `item-${id}`, flag: false }, overrides ?? {});

/** Seed a SWR cache key with a value, without triggering revalidation */
const seed = <T,>(key: string, value: T) => globalMutate(key, value, false);

// Kick off a mutation with a deferred (not-yet-resolved) request, so the test can inspect
// the optimistic cache state before choosing to resolve or reject it.
function triggerMutate<T>(mutate: GangedMutator<T>, options?: Parameters<GangedMutator<T>>[1]) {
	const request = Promise.withResolvers<T>();

	// Triggering the mutation causes a React state update (the optimistic write)
	const settled = mutate(request.promise, options);

	return {
		/** The underlying promise (in production, the action causing a mutation).
		 * Used to resolve or reject the mutation */
		request,
		/** The promise returned by SWR `mutate()` */
		settled,
	};
}

beforeEach(() => {
	globalMutate(() => true, undefined, { revalidate: false });
});

describe('createMutation', () => {
	test('All key resolvers are evaluated against the same state', async () => {
		// Key resolvers must be evaluated against the SWR cache before any mutation occurred,
		// unaffected by earlier keys in the same call.

		const item = itemBuilder('a', { label: 'orig' });
		await seed('/list-a', [item]);
		// list-b?orig is named after item a's current label, simulating a key derived from contents of another cache.
		await seed('/list-b?orig', [itemBuilder('a')]);

		const useMutation = createMutation<Item>(
			list(() => '/list-a'),
			list((id, cache) => {
				// Get item 'a' from the (pre-mutation) '/list-a' cache, to compute the derived key
				const listA: Item[] | undefined = cache.get('/list-a')?.data;
				const found = listA?.find(entry => entry.id === id);

				return found ? `/list-b?${found.label}` : undefined;
			}),
		);
		const { mutate } = (await renderHook(() => useMutation('a'))).result.current;

		// Mutate item 'a', changing its label.
		const { request, settled } = triggerMutate<Item>(mutate, {
			optimisticData: { ...item, label: 'changed' },
		});
		request.resolve({ ...item, label: 'changed' });
		await settled;

		// Assert: the second key resolver used 'orig' not 'changed' (the pre-mutation label) to update '/list-b?orig',
		// proving resolvers see cache state as it was before this mutation call started.
		const orig = await globalMutate<Item[]>('/list-b?orig');
		expect(orig?.find(entry => entry.id === 'a')?.label).toBe('changed');

		const changed = await globalMutate<Item[]>('/list-b?changed');
		expect(changed).toBeUndefined();
	});

	test('Each mutation promise is returned', async () => {
		// This assertion is necessary as a precondition to the next test

		const useMutation = createMutation<{ id: string }>(
			list(() => '/list'),
			list(() => '/thing'),
			detail(() => '/item'),
		);
		const { mutate } = (await renderHook(() => useMutation('a'))).result.current;

		const { request, settled } = triggerMutate<{ id: string }>(mutate);
		request.resolve({ id: 'a' });

		expect(await settled).toHaveLength(3);
	});

	test('A key resolver returning undefined is omitted, while resolved keys still mutate', async () => {
		const item = itemBuilder('a');
		await seed('/list', [item]);

		const useMutation = createMutation<Item>(
			list(() => '/list'),
			// Second key resolver always returns undefined, meaning "no key to mutate here".
			list(() => undefined),
		);
		const { mutate } = (await renderHook(() => useMutation('a'))).result.current;

		const { request, settled } = triggerMutate<Item>(mutate, {
			optimisticData: { ...item, flag: true },
		});
		request.resolve({ ...item, flag: true });

		// Assert: only 1 promise returned: the undefined-returning resolver was skipped entirely
		expect(await settled).toHaveLength(1);
		expect(await globalMutate<Item[]>('/list')).toEqual([{ ...item, flag: true }]);
	});

	test('Calling mutate without data revalidates without clearing cached values', async () => {
		const item = itemBuilder('a');
		await seed('/detail/a', item);
		await seed('/list', [item]);

		const useMutation = createMutation<Item>(
			detail(id => `/detail/${id}`),
			list(() => '/list'),
		);
		const { mutate } = (await renderHook(() => useMutation('a'))).result.current;

		await mutate();

		expect(await globalMutate<Item>('/detail/a')).toEqual(item);
		expect(await globalMutate<Item[]>('/list')).toEqual([item]);
	});

	test('A data callback receives matching item entity', async () => {
		const item = itemBuilder('a');
		await seed('/detail/a', item);
		await seed('/list', [item]);

		const useMutation = createMutation<Item>(
			detail(id => `/detail/${id}`),
			list(() => '/list'),
		);
		const { mutate } = (await renderHook(() => useMutation('a'))).result.current;

		await mutate(current => {
			assert(current, 'Expected the matching cached entity to be passed to the data callback');
			return { ...current, flag: true };
		});

		expect(await globalMutate<Item>('/detail/a')).toEqual({ ...item, flag: true });
		expect(await globalMutate<Item[]>('/list')).toEqual([{ ...item, flag: true }]);
	});

	describe('detail scope', () => {
		test('A rejected mutation applies and then rolls back the optimistic update', async () => {
			const item = itemBuilder('a');
			await seed('/detail/a', item);

			// Set up a mutation hook scoped to the single '/detail/:id' key.
			const useMutation = createMutation<Item>(detail(id => `/detail/${id}`));
			const { mutate } = (await renderHook(() => useMutation('a'))).result.current;

			const { request, settled } = triggerMutate<Item>(mutate, {
				optimisticData: current => {
					assert(current, 'Expected the current cached detail to be passed to the patch function');
					return { ...current, flag: true };
				},
			});

			// Assert: the optimistic patch is applied to the cache immediately, before the request settles.
			expect(await globalMutate<Item>('/detail/a')).toEqual({ ...item, flag: true });

			// The underlying request fails
			request.reject(new Error('Network error'));
			await settled;

			// Assert: the cache is rolled back to its pre-mutation value.
			expect(await globalMutate<Item>('/detail/a')).toEqual(item);
		});

		test('A rollbackOnError predicate can retain optimistic data after rejection', async () => {
			const item = itemBuilder('a');
			await seed('/detail/a', item);

			const useMutation = createMutation<Item>(detail(id => `/detail/${id}`));
			const { mutate } = (await renderHook(() => useMutation('a'))).result.current;
			const optimistic = { ...item, flag: true };
			const { request, settled } = triggerMutate<Item>(mutate, {
				optimisticData: optimistic,
				rollbackOnError: () => false,
			});

			request.reject(new Error('Network error'));
			await settled;

			expect(await globalMutate<Item>('/detail/a')).toEqual(optimistic);
		});

		test('Successful mutation writes the resolved data into the cache', async () => {
			const item = itemBuilder('a');
			await seed('/detail/a', item);

			const useMutation = createMutation<Item>(detail(id => `/detail/${id}`));
			const { mutate } = (await renderHook(() => useMutation('a'))).result.current;

			// Act: start a mutation with a static (non-function) optimistic patch.
			const { request, settled } = triggerMutate<Item>(mutate, {
				optimisticData: { ...item, flag: true },
			});

			// The server will return a different value than the optimistic patch used
			const resolved = { ...item, label: 'server-label' };

			request.resolve(resolved);
			await settled;

			// Assert: once resolved, the cache reflects the actual server response, not the optimistic data
			expect(await globalMutate<Item>('/detail/a')).toEqual(resolved);
		});

		test('Rejected mutation on an uncached key reverts to undefined', async () => {
			// No `seed()` call: '/detail/uncached' has no prior cache entry
			const useMutation = createMutation<Item>(detail(() => '/detail/uncached'));
			const { mutate } = (await renderHook(() => useMutation('x'))).result.current;

			const item = itemBuilder('x', { flag: true });
			const { request, settled } = triggerMutate<Item>(mutate, { optimisticData: item });

			expect(await globalMutate<Item>('/detail/uncached')).toEqual(item);

			request.reject(new Error('Network error'));
			await settled;

			// Assert: rollback reverts to undefined
			expect(await globalMutate<Item>('/detail/uncached')).toBeUndefined();
		});

		describe('Mutation race conditions', () => {
			function startRace(mutate: GangedMutator<Item>, item: Item) {
				const a = triggerMutate<Item>(mutate, { optimisticData: { ...item, label: 'A' } });
				const b = triggerMutate<Item>(mutate, { optimisticData: { ...item, flag: true } });
				return { a, b };
			}

			test('If the earlier mutation (A) fails, it does not rollback over the still-active later mutation (B)', async () => {
				const item = itemBuilder('a');
				await seed('/detail/a', item);

				const useMutation = createMutation<Item>(detail(id => `/detail/${id}`));
				const { mutate } = (await renderHook(() => useMutation('a'))).result.current;
				const { a, b } = startRace(mutate, item);

				a.request.reject(new Error('Network error'));
				await a.settled;

				// Assert: `A` rollback must not clobber `B` still-active optimistic write
				expect(await globalMutate<Item>('/detail/a')).toEqual({ ...item, flag: true });

				b.request.resolve({ ...item, flag: true });
				await b.settled;
			});

			test('If the later mutation (B) fails, it rollback only its own change, preserving the still-pending earlier mutation (A)', async () => {
				const item = itemBuilder('a');
				await seed('/detail/a', item);

				const useMutation = createMutation<Item>(detail(id => `/detail/${id}`));
				const { mutate } = (await renderHook(() => useMutation('a'))).result.current;
				const { a, b } = startRace(mutate, item);

				b.request.reject(new Error('Network error'));
				await b.settled;

				// Assert: rolling back `B` must restore `A` still-pending value, not the pre-A original
				expect(await globalMutate<Item>('/detail/a')).toEqual({ ...item, label: 'A' });

				a.request.resolve({ ...item, label: 'A' });
				await a.settled;
			});
		});
	});

	describe('list scope', () => {
		test('An optimistic patch affects only the matching item, leaving others untouched', async () => {
			const a = itemBuilder('a');
			const b = itemBuilder('b');
			await seed('/list', [a, b]);

			const useMutation = createMutation<Item>(list(() => '/list'));

			// Call useMutation hook for item A
			const { mutate } = (await renderHook(() => useMutation('a'))).result.current;
			const { request, settled } = triggerMutate<Item>(mutate, {
				optimisticData: current => {
					assert(current, 'Expected the matching item to be passed to the patch function');
					return { ...current, flag: true };
				},
			});

			// Assert: only A is optimistically patched; B is untouched
			const optimisticItems = await globalMutate<Item[]>('/list');
			expect(optimisticItems?.find(item => item.id === 'a')).toEqual({ ...a, flag: true });
			expect(optimisticItems?.find(item => item.id === 'b')).toEqual(b);

			request.resolve({ ...a, flag: true });
			await settled;

			const settledItems = await globalMutate<Item[]>('/list');
			expect(settledItems?.find(item => item.id === 'a')).toEqual({ ...a, flag: true });
			expect(settledItems?.find(item => item.id === 'b')).toEqual(b);
		});

		test('Successful mutation overwrites only the matching item with resolved data', async () => {
			const a = itemBuilder('a');
			await seed('/list', [a]);

			const useMutation = createMutation<Item>(list(() => '/list'));
			const { mutate } = (await renderHook(() => useMutation('a'))).result.current;

			// Trigger mutation with optimistic patch
			const { request, settled } = triggerMutate<Item>(mutate, {
				optimisticData: { ...a, flag: true },
			});

			// Resolve with server data that differs from the optimistic patch
			const resolved = { ...a, label: 'server-label' };
			request.resolve(resolved);
			await settled;

			// Assert: once resolved, the matching list item reflects the actual server response
			const items = await globalMutate<Item[]>('/list');
			expect(items?.find(item => item.id === 'a')).toEqual(resolved);
		});

		test('Successful void mutation retains the optimistic value for the matching item', async () => {
			const a = itemBuilder('a');
			await seed('/list', [a]);

			const useMutation = createMutation<Item>(list(() => '/list'));
			const { mutate } = (await renderHook(() => useMutation('a'))).result.current;
			const request = Promise.withResolvers<void>();

			// biome-ignore lint/suspicious/noExplicitAny: We are intentionally checking an invalid response
			const settled = mutate(request.promise as any, { optimisticData: { ...a, flag: true } });

			request.resolve();
			await settled;

			expect(await globalMutate<Item[]>('/list')).toEqual([{ ...a, flag: true }]);
		});

		test('Rejected mutation rolls back only the affected item, preserving pending optimistic updates', async () => {
			const [a, b] = [itemBuilder('a'), itemBuilder('b')];
			await seed('/list', [a, b]);

			const useMutation = createMutation<Item>(list(() => '/list'));
			const mutateA = (await renderHook(() => useMutation('a'))).result.current.mutate;
			const mutateB = (await renderHook(() => useMutation('b'))).result.current.mutate;

			// Start two concurrent, independent optimistic mutations
			const { request: requestA, settled: settledA } = triggerMutate<Item>(mutateA, {
				optimisticData: { ...a, flag: true },
			});
			const { request: requestB, settled: settledB } = triggerMutate<Item>(mutateB, {
				optimisticData: { ...b, label: 'b-updated' },
			});

			// Request A fails
			requestA.reject(new Error('Network error'));
			await settledA;

			// Assert: `A` rolls back to its original value, but still-pending `B` optimistic patch survives
			const items = await globalMutate<Item[]>('/list');
			expect(items?.find(item => item.id === 'a')).toEqual(a);
			expect(items?.find(item => item.id === 'b')?.label).toBe('b-updated');

			requestB.resolve({ ...b, label: 'b-updated' });
			await settledB;

			// Assert: `B` settling doesn't disturb state
			expect(await globalMutate<Item[]>('/list')).toEqual(items);
		});

		test('Rejected mutation does not rollback over a superseding mutation', async () => {
			const a = itemBuilder('a');
			await seed('/list', [a]);

			const useMutation = createMutation<Item>(list(() => '/list'));
			const { mutate } = (await renderHook(() => useMutation('a'))).result.current;

			// Start mutation A, then start mutation B on the same item id before A settles
			const { request: requestA, settled: settledA } = triggerMutate<Item>(mutate, {
				optimisticData: { ...a, label: 'A' },
			});
			const { request: requestB, settled: settledB } = triggerMutate<Item>(mutate, {
				optimisticData: { ...a, label: 'B' },
			});

			// A fails after B has already applied its own optimistic write
			requestA.reject(new Error('Network error'));
			await settledA;

			// Assert: rollback `A` must not clobber still-pending `B` optimistic value
			const items = await globalMutate<Item[]>('/list');
			expect(items?.find(item => item.id === 'a')).toEqual({ ...a, label: 'B' });

			requestB.resolve({ ...a, label: 'B' });
			await settledB;

			const settledItems = await globalMutate<Item[]>('/list');
			expect(settledItems?.find(item => item.id === 'a')).toEqual({ ...a, label: 'B' });
		});

		test('Successful mutation on an uncached list key does not discard the resolved data', async () => {
			// No `seed()` call: '/list-uncached' has no prior cache entry
			const useMutation = createMutation<Item>(list(() => '/list-uncached'));
			const { mutate } = (await renderHook(() => useMutation('a'))).result.current;

			const resolved = itemBuilder('a', { flag: true });
			const { request, settled } = triggerMutate<Item>(mutate, { optimisticData: resolved });
			request.resolve(resolved);
			await settled;

			// Assert: the resolved item is present in the list
			expect(await globalMutate<Item[]>('/list-uncached')).toEqual([resolved]);
		});
	});
});
