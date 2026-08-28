import { describe, expect, test, vi } from 'vitest';

import { createOptimisticResource } from './resource';
import {
	createControlledMutation,
	type MutationControl,
	settleAll,
	setupTest,
} from './tests/helpers';

describe('createOptimisticResource()', { timeout: 1000 }, () => {
	type Entity = { id: string; favorite: boolean; archived: boolean };

	const queryKey = ['entities'] as const;
	const invalidates = vi.fn(() => [queryKey]);

	const resource = createOptimisticResource<Entity>({
		mutationKey: ['entity-mutation'],
		invalidates,
	});

	describe('useOptimisticMutation()', () => {
		describe('Concurrency', () => {
			test('Executes distinct caller scopes on the same entity concurrently', async () => {
				const controls: MutationControl[] = [];
				const a = createControlledMutation(controls);
				const b = createControlledMutation(controls);

				const { act, result } = await setupTest(() => ({
					a: resource.useOptimisticMutation({
						targetId: 'target',
						mutationFn: a.mutationFn,
						scope: { id: 'a' },
					}),
					b: resource.useOptimisticMutation({
						targetId: 'target',
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
					a1: resource.useOptimisticMutation({
						targetId: 'target',
						mutationFn: a1Mutation.mutationFn,
					}),
					a2: resource.useOptimisticMutation({
						targetId: 'target',
						mutationFn: a2Mutation.mutationFn,
					}),
					b1: resource.useOptimisticMutation({
						targetId: 'other',
						mutationFn: b1Mutation.mutationFn,
					}),
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
						a1: resource.useOptimisticMutation({
							targetId: undefined,
							mutationFn: a1Mutation.mutationFn,
						}),
						a2: resource.useOptimisticMutation({
							targetId: undefined,
							mutationFn: a2Mutation.mutationFn,
						}),
						b1: resourceB.useOptimisticMutation({
							targetId: undefined,
							mutationFn: b1Mutation.mutationFn,
						}),
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
					bound: resource.useOptimisticMutation({
						targetId: 'invoiceId',
						mutationFn: () => Promise.resolve(),
					}),
					unbound: resource.useOptimisticMutation({
						targetId: undefined,
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
					a: resource.useOptimisticMutation({
						targetId: 'target',
						mutationFn: a.mutationFn,
						onSettled: aSettled,
						onSuccess: aSuccess,
					}),
					b: resource.useOptimisticMutation({
						targetId: 'target',
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
					a: resource.useOptimisticMutation({
						targetId: 'target',
						mutationFn: a.mutationFn,
						onSettled: aSettled,
						onError: aError,
					}),
					b: resource.useOptimisticMutation({
						targetId: 'target',
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
					first: resource.useOptimisticMutation({
						targetId: 'target',
						mutationFn: a.mutationFn,
						onError: aError,
					}),
					second: resource.useOptimisticMutation({ targetId: 'target', mutationFn: b.mutationFn }),
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
