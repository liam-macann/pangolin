import { describe, expect, test, vi } from 'vitest';

import { useInvalidatingMutation } from './mutation';
import { createDeferred, setupTest } from './tests/helpers';

describe('useInvalidatingMutation()', { timeout: 1000 }, () => {
	describe('Invalidation', () => {
		test('Awaits onSuccess callback before invalidation', async () => {
			const callback = createDeferred();
			const onSuccess = vi.fn(() => callback.promise);
			const { act, result, QueryClient } = await setupTest(() =>
				useInvalidatingMutation({ mutationFn: () => Promise.resolve('saved'), onSuccess }, [
					['first-query'],
					['second-query'],
				]),
			);
			const invalidate = vi.spyOn(QueryClient, 'invalidateQueries');

			const mutationResult = result.current.mutateAsync(undefined);
			await act(() => Promise.resolve()); // flush React

			expect(onSuccess).toHaveBeenCalledOnce();
			expect(invalidate).not.toHaveBeenCalled();
			await expect.poll(() => result.current.status).toBe('pending');

			// Invalidation must not begin until the caller onSuccess callback settles
			callback.resolve();
			await act(() => mutationResult);
			expect(invalidate).toHaveBeenCalledWith({ queryKey: ['first-query'] });
			expect(invalidate).toHaveBeenCalledWith({ queryKey: ['second-query'] });
			expect(invalidate).toHaveBeenCalledTimes(2);
			await expect.poll(() => result.current.status).toBe('success');
		});

		test('Awaits every query invalidation before succeeding', async () => {
			const [firstInvalidation, secondInvalidation] = [createDeferred(), createDeferred()];
			const { act, result, QueryClient } = await setupTest(() =>
				useInvalidatingMutation({ mutationFn: () => Promise.resolve('saved') }, [
					['first-query'],
					['second-query'],
				]),
			);

			const invalidate = vi
				.spyOn(QueryClient, 'invalidateQueries')
				.mockImplementationOnce(() => firstInvalidation.promise)
				.mockImplementationOnce(() => secondInvalidation.promise);

			const mutationPromise = result.current.mutateAsync(undefined);
			await act(() => Promise.resolve());
			expect(invalidate).toHaveBeenCalledTimes(2);

			// One completed invalidation is insufficient; another remains pending
			firstInvalidation.resolve();
			await act(() => Promise.resolve());
			await expect.poll(() => result.current.status).toBe('pending');

			// Both invalidations have settled
			secondInvalidation.resolve();
			await act(() => mutationPromise);
			await expect.poll(() => result.current.status).toBe('success');
		});
	});

	describe('Rollback', () => {
		test('Invalidates queries when onSuccess rejects', async () => {
			const callback = createDeferred();

			const { act, result, QueryClient } = await setupTest(() =>
				useInvalidatingMutation(
					{
						mutationFn: () => Promise.resolve('saved'),
						onSuccess: () => callback.promise,
					},
					[['query']],
				),
			);

			const invalidateSpy = vi.spyOn(QueryClient, 'invalidateQueries');

			const error = new Error('Success callback failed');
			await act(() => {
				callback.reject(error);
				return expect(result.current.mutateAsync()).rejects.toBe(error);
			});

			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['query'] });
			await expect.poll(() => result.current.status).toBe('error');
		});

		test('Keeps a successful mutation successful when query invalidation fails', async () => {
			const invalidation = createDeferred();
			const { act, result, QueryClient } = await setupTest(() =>
				useInvalidatingMutation({ mutationFn: () => Promise.resolve('saved') }, [['query']]),
			);
			vi.spyOn(QueryClient, 'invalidateQueries').mockImplementation(() => invalidation.promise);

			const error = new Error('Invalidation failed');
			await act(() => {
				invalidation.reject(error);
				return expect(result.current.mutateAsync()).resolves.toBe('saved');
			});

			await expect.poll(() => result.current.status).toBe('success');
		});
	});
});
