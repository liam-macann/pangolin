import { type QueryKey, type UseMutationOptions, useMutation } from '@tanstack/react-query';

export type MutationOptions<TData, TError, TVariables, TOnMutateResult = unknown> = Omit<
	UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
	'onMutate' | 'mutationKey'
>;

type InvalidatingMutationOptions<TData, TError, TVariables, TOnMutateResult> = UseMutationOptions<
	TData,
	TError,
	TVariables,
	TOnMutateResult
> & {
	invalidates: readonly QueryKey[];
};

/** Creates a mutation that awaits related query invalidation after success */
export function useInvalidatingMutation<TData, TError, TVariables, TOnMutateResult>({
	invalidates,
	...options
}: InvalidatingMutationOptions<TData, TError, TVariables, TOnMutateResult>) {
	return useMutation({
		...options,
		onSuccess: async (data, variables, mutationResult, context, ...args) => {
			try {
				await options.onSuccess?.(data, variables, mutationResult, context, ...args);
			} finally {
				await Promise.allSettled(
					invalidates.map(queryKey => context.client.invalidateQueries({ queryKey })),
				);
			}
		},
	});
}
