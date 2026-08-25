import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { assert, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';

export const createDeferred = () => Promise.withResolvers<void>();

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

export const settleAll = (controls: MutationControl[]) =>
	Promise.allSettled(controls.map(control => control.resolve()));

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
		bind: (
			act: (callback: () => void) => Promise<unknown>,
			mutateAsync: (value: TVariables) => Promise<unknown>,
		) => ({
			mutateAsync: async (value: TVariables) => {
				const request = createDeferred();
				requests.push(request);

				let result = Promise.resolve<unknown>(undefined);
				await act(() => {
					result = mutateAsync(value);
				});

				const control: MutationControl = {
					result,
					server: request,
					resolve: async () => {
						request.resolve();
						await result;
					},
					reject: async (err = new Error('Mutation rejected')) => {
						request.reject(err);
						await result.catch(() => undefined);
					},
				};
				controls?.push(control);
				return control;
			},
		}),
	};
}
