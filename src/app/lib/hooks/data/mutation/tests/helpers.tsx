import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { assert, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';

export const createDeferred = () => Promise.withResolvers<void>();

type Act = (callback: () => unknown) => Promise<unknown>;

/**
 * Wait out a full timer cycle inside `act()`
 *
 * TanStack Query schedules cache notifications via `setTimeout(0)`, so a microtask flush
 * `act(() => Promise.resolve())` settles the mutation promise but not the re-render
 */
export const settle = (act: Act) => act(() => new Promise(resolve => setTimeout(resolve, 10)));

/** Wraps a render callback with QueryClientProvider */
export async function setupTest<T>(renderCallback: () => T) {
	const client = new QueryClient();
	const view = await renderHook(renderCallback, {
		wrapper: ({ children }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		),
	});
	return { ...view, QueryClient: client };
}

export type MutationControl = {
	/** Stores the mutateAsync promise. Awaits hook invalidation lifecycle */
	result: Promise<unknown>;
	/** Resolve or reject the underlying server request */
	server: PromiseWithResolvers<void>;
	/** Resolves the entire mutation */
	resolve: () => Promise<void>;
	/** Rejects the entire mutation */
	reject: (err?: Error) => Promise<void>;
};

export const settleAll = async (controls: MutationControl[]) => {
	for (const control of controls) control.server.resolve();
	await Promise.allSettled(controls.map(control => control.result));
};

/** Create a mutation hook, that remains pending until manually resolved */
export function createControlledMutation<TVariables = void>(controls?: MutationControl[]) {
	const requests: ReturnType<typeof createDeferred>[] = [];
	const mutationFn = vi.fn((_value: TVariables) => {
		const request = requests.shift();
		assert(request, `Mutation must have a matching request control`);
		return request.promise;
	});

	return {
		mutationFn,
		bind: (act: Act, mutateAsync: (value: TVariables) => Promise<unknown>) => ({
			mutateAsync: async (value: TVariables) => {
				const request = createDeferred();
				requests.push(request);

				const result = mutateAsync(value);
				// Commit the optimistic overlay before the caller inspects rendered state
				await settle(act);

				const control: MutationControl = {
					result,
					server: request,
					resolve: async () => {
						request.resolve();
						await result.catch(() => undefined);
						await settle(act);
					},
					reject: async (err = new Error('Mutation rejected')) => {
						request.reject(err);
						await result.catch(() => undefined);
						await settle(act);
					},
				};
				controls?.push(control);
				return control;
			},
		}),
	};
}
