import {
	type DefaultError,
	type UseSuspenseQueryOptions,
	useSuspenseQuery,
} from '@tanstack/react-query';
import { describe, expect, test, vi } from 'vitest';

import { createOptimisticResource } from './resource';
import {
	createControlledMutation,
	type MutationControl,
	settle,
	settleAll,
	setupTest,
} from './tests/helpers';

describe('createOptimisticResource()', { timeout: 1000 }, () => {
	type Entity = { id: string; favorite: boolean; archived: boolean };

	const queryKey = ['entities'] as const;
	const serverEntities: Entity[] = [
		{ id: 'target', favorite: false, archived: false },
		{ id: 'other', favorite: false, archived: false },
	];
	const applyUpdate = (entities: Entity[], update: (entity: Entity) => Entity) =>
		entities.map(update);
	const invalidates = vi.fn(() => [queryKey]);

	const resource = createOptimisticResource<Entity>({
		mutationKey: ['entity-mutation'],
		invalidates,
	});

	describe('useOptimisticSelect()', () => {
		/** Sets up mutation hooks, and returns a helper to fetch a snapshot */
		async function setupMutations<TData = Entity[]>(
			options?: Omit<
				UseSuspenseQueryOptions<Entity[], DefaultError, TData, typeof queryKey>,
				'queryFn' | 'queryKey'
			>,
		) {
			const opts = { queryKey, queryFn: () => Promise.resolve(serverEntities), ...options };

			const requests: MutationControl[] = [];
			const favoriteMutation = createControlledMutation<boolean>(requests);
			const archiveMutation = createControlledMutation<boolean>(requests);

			const { act, result, QueryClient } = await setupTest(() => {
				const select = resource.useOptimisticSelect(applyUpdate, options?.select);

				return {
					useEntity: useSuspenseQuery({ initialData: serverEntities, ...opts, select }),

					useMutateFavorite: resource.useOptimisticMutation({
						targetId: 'target',
						mutationFn: favoriteMutation.mutationFn,
						scope: { id: 'favorite' },
						optimisticFn: (entity, val) => ({ ...entity, favorite: val }),
					}),
					useMutateArchived: resource.useOptimisticMutation({
						targetId: 'target',
						mutationFn: archiveMutation.mutationFn,
						scope: { id: 'archive' },
						optimisticFn: (entity, val) => ({ ...entity, archived: val }),
					}),
				};
			});

			const hooks = {
				favorite: favoriteMutation.bind(act, value =>
					result.current.useMutateFavorite.mutateAsync(value),
				),
				archive: archiveMutation.bind(act, value =>
					result.current.useMutateArchived.mutateAsync(value),
				),
			};
			const flush = () => settle(act);

			const snapshot = () => ({
				/** Data with optimistic overlay; what is visible in the UI */
				overlaid: result.current.useEntity.data,
				/** Data sitting in the TanStack cache; the last server response. */
				cache: QueryClient.getQueryData<Entity[]>(queryKey),
			});

			return { flush, hooks, QueryClient, settleAll: () => settleAll(requests), snapshot };
		}

		describe('Concurrency', () => {
			test('Replays concurrent intents over server data, preserving response cache', async () => {
				const { hooks, settleAll, snapshot } = await setupMutations();

				await hooks.favorite.mutateAsync(true);
				await hooks.archive.mutateAsync(true).then(res => res.resolve());

				const { cache, overlaid } = snapshot();

				const visibleTarget = overlaid.find(entity => entity.id === 'target');
				const cachedTarget = cache?.find(entity => entity.id === 'target');

				expect(visibleTarget?.favorite).toBe(true);
				expect(cachedTarget?.favorite).toBe(false);

				await settleAll();
			});

			test('Applies select after replaying intents', async () => {
				const { hooks, settleAll, snapshot } = await setupMutations({
					select: entities => entities.find(entity => entity.id === 'target')?.favorite,
				});

				await hooks.favorite.mutateAsync(true);
				await hooks.archive.mutateAsync(true).then(res => res.resolve());

				expect(snapshot().overlaid).toBe(true);

				await settleAll();
			});

			test('Resolves overlapping mutations independently', async () => {
				const { hooks, settleAll } = await setupMutations();

				const first = await hooks.favorite.mutateAsync(true);
				const second = await hooks.favorite.mutateAsync(false);

				const secondSettled = vi.fn();
				second.result.then(secondSettled);

				await first.resolve();
				expect(secondSettled).not.toHaveBeenCalled();

				await second.resolve();
				expect(secondSettled).toHaveBeenCalledOnce();

				await settleAll();
			});
		});

		describe('Rollback', () => {
			test('Removes a failed optimistic update without changing cached server data', async () => {
				const { flush, hooks, settleAll, snapshot } = await setupMutations();

				const request = await hooks.favorite.mutateAsync(true);
				expect(snapshot().overlaid.find(entity => entity.id === 'target')?.favorite).toBe(true);

				const error = new Error('Favorite request failed');
				request.server.reject(error);
				await expect(request.result).rejects.toBe(error);
				await flush();

				const { cache, overlaid } = snapshot();
				expect(overlaid.find(entity => entity.id === 'target')?.favorite).toBe(false);
				expect(cache).toEqual(serverEntities);

				await settleAll();
			});
		});

		describe('Targeting', () => {
			test('Only applies an optimistic update to its target entity', async () => {
				const { hooks, settleAll, snapshot } = await setupMutations();

				await hooks.favorite.mutateAsync(true);
				expect(snapshot().overlaid).toEqual([
					{ id: 'target', favorite: true, archived: false },
					{ id: 'other', favorite: false, archived: false },
				]);

				await settleAll();
			});
		});
	});
});
