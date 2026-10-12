import { AsyncLocalStorage } from 'node:async_hooks';
import { after } from 'next/server';
import { assert, onTestFinished, vi } from 'vitest';

/** Captures the callback an action schedules with `after()`, bound to the context it was scheduled in.
 *  @returns A function that runs the captured callback, as the request finishing would. */
export function captureAfter() {
	let deferred: (() => unknown) | undefined;

	const mock = vi.mocked(after).mockImplementation(callback => {
		if (typeof callback === 'function') deferred = AsyncLocalStorage.bind(callback);
	});

	onTestFinished(() => void mock.mockReset());

	return async () => {
		assert(deferred, 'Expected a callback to be scheduled with after()');
		await deferred();
	};
}
