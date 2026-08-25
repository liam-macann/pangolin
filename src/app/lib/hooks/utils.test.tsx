import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { useAsyncStatus } from './utils';

describe('useAsyncStatus', () => {
	const createDeferred = () => Promise.withResolvers<void>();

	beforeAll(() => vi.useFakeTimers());
	afterAll(() => vi.useRealTimers());

	test('Immediately reflect change after replacing the tracked promise', async () => {
		const first = createDeferred();
		const second = createDeferred();
		const { act, result } = await renderHook(() => useAsyncStatus({ loadingDelay: 500 }));

		let firstResult = Promise.resolve();
		await act(() => {
			firstResult = result.current[1](first.promise);
		});
		expect(result.current[0]).toBeNull();

		first.resolve();
		await act(() => firstResult);
		expect(result.current[0]).toBe('fulfilled');

		let secondResult = Promise.resolve();
		await act(() => {
			secondResult = result.current[1](second.promise);
		});
		expect(result.current[0]).toBe('pending');

		second.reject();
		await act(() => secondResult.catch(() => undefined));
		expect(result.current[0]).toBe('rejected');
	});

	test('Rethrows the tracked promise error', async () => {
		const deferred = createDeferred();
		const error = new Error('Request failed');
		const { act, result } = await renderHook(() => useAsyncStatus());

		let trackedResult = Promise.resolve();
		await act(() => {
			trackedResult = result.current[1](deferred.promise);
		});

		deferred.reject(error);
		await act(() => expect(trackedResult).rejects.toBe(error));
		expect(result.current[0]).toBe('rejected');
	});

	test('Ignores a superseded promise and restarts delays', async () => {
		const first = createDeferred();
		const second = createDeferred();
		const { act, result } = await renderHook(() => useAsyncStatus({ loadingDelay: 500 }));

		await act(() => {
			result.current[1](first.promise);
			vi.advanceTimersByTime(300);
			result.current[1](second.promise);
			vi.advanceTimersByTime(200);
		});
		expect(result.current[0]).toBeNull();

		await act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(result.current[0]).toBe('pending');

		first.resolve();
		await act(() => first.promise);
		expect(result.current[0]).toBe('pending');

		second.resolve();
		await act(() => second.promise);
	});
});
