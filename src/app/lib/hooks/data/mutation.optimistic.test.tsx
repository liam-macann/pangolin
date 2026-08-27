import { describe, expect, test, vi } from 'vitest';

import { type QueryOptionsFor } from './helpers';
import { createOptimisticResource } from './mutation';
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

	describe('useOptimisticQuery()', () => {
		/** Sets up mutation hooks, and returns a helper to fetch a snapshot */
		async function setupMutations<TData = Entity[]>(options?: QueryOptionsFor<Entity[], TData>) {
			const opts = { queryKey, queryFn: () => Promise.resolve(serverEntities), ...options };

			const requests: MutationControl[] = [];
			const favoriteMutation = createControlledMutation<boolean>(requests);
			const archiveMutation = createControlledMutation<boolean>(requests);

			const { act, result, QueryClient } = await setupTest(() => ({
				useEntity: resource.useOptimisticQuery<Entity[], TData>(
					{ initialData: serverEntities, ...opts },
					applyUpdate,
				),

				useMutateFavourite: resource.useOptimisticMutation(
					'target',
					{ mutationFn: favoriteMutation.mutationFn, scope: { id: 'favorite' } },
					(entity, val) => ({ ...entity, favorite: val }),
				),
				useMutateArchived: resource.useOptimisticMutation(
					'target',
					{ mutationFn: archiveMutation.mutationFn, scope: { id: 'archive' } },
					(entity, val) => ({ ...entity, archived: val }),
				),
			}));

			const hooks = {
				favorite: favoriteMutation.bind(act, value =>
					result.current.useMutateFavourite.mutateAsync(value),
				),
				archive: archiveMutation.bind(act, value =>
					result.current.useMutateArchived.mutateAsync(value),
				),
			};
			const flush = () => settle(act);

			const snapshot = () => ({
				/** Data with optimistic overlay; what is visible in the UI */
				overlaid: result.current.useEntity.data,
				/** Data sitting in the Tanstack cache; the last server response */
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

	describe('useOptimisticMutation()', () => {
		describe('Concurrency', () => {
			test('Executes distinct caller scopes on the same entity concurrently', async () => {
				const controls: MutationControl[] = [];
				const a = createControlledMutation(controls);
				const b = createControlledMutation(controls);

				const { act, result } = await setupTest(() => ({
					a: resource.useOptimisticMutation('target', {
						mutationFn: a.mutationFn,
						scope: { id: 'a' },
					}),
					b: resource.useOptimisticMutation('target', {
						mutationFn: b.mutationFn,
						scope: { id: 'b' },
					}),
				}));

				await a.bind(act, () => result.current.a.mutateAsync()).mutateAsync();
				await b.bind(act, () => result.current.b.mutateAsync()).mutateAsync();
				await act(() => Promise.resolve()); // flush React

				// Neither has resolved; both mutationFn should have been called
				expect(a.mutationFn).toHaveBeenCalledOnce();
				expect(b.mutationFn).toHaveBeenCalledOnce();

				await settleAll(controls);
			});

			test('Executes mutations on the same entity in serial', async () => {
				// A single entity (of the same caller scope) must execute overlapping mutationFn in sequence
				// This tests a single resource kind: an entity is a single invoice, single client, etc.
				const controls: MutationControl[] = [];
				const a1Mutation = createControlledMutation(controls);
				const a2Mutation = createControlledMutation(controls);
				const b1Mutation = createControlledMutation(controls);

				const { act, result } = await setupTest(() => ({
					a1: resource.useOptimisticMutation('target', { mutationFn: a1Mutation.mutationFn }),
					a2: resource.useOptimisticMutation('target', { mutationFn: a2Mutation.mutationFn }),
					b1: resource.useOptimisticMutation('other', { mutationFn: b1Mutation.mutationFn }),
				}));

				const a1 = await a1Mutation.bind(act, () => result.current.a1.mutateAsync()).mutateAsync();
				await a2Mutation.bind(act, () => result.current.a2.mutateAsync()).mutateAsync();
				await b1Mutation.bind(act, () => result.current.b1.mutateAsync()).mutateAsync();

				expect(a1Mutation.mutationFn).toHaveBeenCalledOnce();
				expect(a2Mutation.mutationFn).not.toHaveBeenCalled();
				// Other entity should be called concurrently
				expect(b1Mutation.mutationFn).toHaveBeenCalledOnce();

				await a1.resolve();
				expect(a2Mutation.mutationFn).toHaveBeenCalledOnce();

				await settleAll(controls);
			});

			test('Executes unbound mutations on the same resource in serial', async () => {
				const controls: MutationControl[] = [];
				const a1Mutation = createControlledMutation(controls);
				const a2Mutation = createControlledMutation(controls);
				const b1Mutation = createControlledMutation(controls);

				const { act, result } = await setupTest(() => {
					const resourceB = createOptimisticResource<Entity>({
						mutationKey: ['other-entity-mutation'],
						invalidates,
					});

					return {
						a1: resource.useOptimisticMutation(undefined, { mutationFn: a1Mutation.mutationFn }),
						a2: resource.useOptimisticMutation(undefined, { mutationFn: a2Mutation.mutationFn }),
						b1: resourceB.useOptimisticMutation(undefined, { mutationFn: b1Mutation.mutationFn }),
					};
				});

				const a1 = await a1Mutation.bind(act, () => result.current.a1.mutateAsync()).mutateAsync();
				await a2Mutation.bind(act, () => result.current.a2.mutateAsync()).mutateAsync();
				await b1Mutation.bind(act, () => result.current.b1.mutateAsync()).mutateAsync();

				expect(a1Mutation.mutationFn).toHaveBeenCalledOnce();
				expect(a2Mutation.mutationFn).not.toHaveBeenCalled();
				expect(b1Mutation.mutationFn).toHaveBeenCalledOnce();

				await a1.resolve();
				expect(a2Mutation.mutationFn).toHaveBeenCalledOnce();

				await settleAll(controls);
			});
		});

		describe('Invalidation', () => {
			test('Derives invalidation targets from the bound entity', async () => {
				invalidates.mockClear();

				await setupTest(() => ({
					bound: resource.useOptimisticMutation('invoiceId', {
						mutationFn: () => Promise.resolve(),
					}),
					unbound: resource.useOptimisticMutation(undefined, {
						mutationFn: () => Promise.resolve(),
					}),
				}));

				expect(invalidates).toHaveBeenCalledWith('invoiceId');
				expect(invalidates).toHaveBeenCalledWith(undefined);
			});
		});

		describe('Rollback', () => {
			test('Suppresses success callbacks (onSettled, onSuccess) for a superseded mutation', async () => {
				const controls: MutationControl[] = [];

				const a = createControlledMutation(controls);
				const b = createControlledMutation(controls);

				const aSettled = vi.fn();
				const aSuccess = vi.fn();
				const bSettled = vi.fn();
				const bSuccess = vi.fn();

				const { act, result } = await setupTest(() => ({
					a: resource.useOptimisticMutation('target', {
						mutationFn: a.mutationFn,
						onSettled: aSettled,
						onSuccess: aSuccess,
					}),
					b: resource.useOptimisticMutation('target', {
						mutationFn: b.mutationFn,
						onSettled: bSettled,
						onSuccess: bSuccess,
					}),
				}));

				const first = await a.bind(act, () => result.current.a.mutateAsync()).mutateAsync();
				const second = await b.bind(act, () => result.current.b.mutateAsync()).mutateAsync();

				await first.resolve();
				expect(aSettled).not.toHaveBeenCalled();
				expect(aSuccess).not.toHaveBeenCalled();

				await second.resolve();
				expect(bSettled).toHaveBeenCalledOnce();
				expect(bSuccess).toHaveBeenCalledOnce();
			});

			test('Suppresses error callbacks (onSettled, onError) for a superseded mutation', async () => {
				const controls: MutationControl[] = [];

				const a = createControlledMutation(controls);
				const b = createControlledMutation(controls);

				const aSettled = vi.fn();
				const aError = vi.fn();
				const bSettled = vi.fn();
				const bError = vi.fn();

				const { act, result } = await setupTest(() => ({
					a: resource.useOptimisticMutation('target', {
						mutationFn: a.mutationFn,
						onSettled: aSettled,
						onError: aError,
					}),
					b: resource.useOptimisticMutation('target', {
						mutationFn: b.mutationFn,
						onSettled: bSettled,
						onError: bError,
					}),
				}));

				const first = await a.bind(act, () => result.current.a.mutateAsync()).mutateAsync();
				const second = await b.bind(act, () => result.current.b.mutateAsync()).mutateAsync();

				await first.reject();
				expect(aSettled).not.toHaveBeenCalled();
				expect(aError).not.toHaveBeenCalled();

				await second.reject();
				expect(bSettled).toHaveBeenCalledOnce();
				expect(bError).toHaveBeenCalledOnce();
			});

			test('Continues a serialized mutation queue after mutation failure', async () => {
				const controls: MutationControl[] = [];
				const a = createControlledMutation(controls);
				const b = createControlledMutation(controls);
				const aError = vi.fn();

				const { act, result } = await setupTest(() => ({
					first: resource.useOptimisticMutation('target', {
						mutationFn: a.mutationFn,
						onError: aError,
					}),
					second: resource.useOptimisticMutation('target', { mutationFn: b.mutationFn }),
				}));

				const first = await a.bind(act, () => result.current.first.mutateAsync()).mutateAsync();
				await b.bind(act, () => result.current.second.mutateAsync()).mutateAsync();

				// Reject first mutation
				const error = new Error('First mutation failed');
				first.server.reject(error);
				await expect(first.result).rejects.toBe(error);
				await act(() => Promise.resolve()); // flush React

				// Second mutation should still be called
				expect(b.mutationFn).toHaveBeenCalledOnce();
				// Error of superseded mutation should not be surfaced
				expect(aError).not.toHaveBeenCalled();

				await settleAll(controls);
			});
		});
	});
});
