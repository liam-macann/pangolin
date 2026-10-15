import {
	type DefaultError,
	hashKey,
	type MutationKey,
	type QueryClient,
	type QueryKey,
	useMutationState,
} from '@tanstack/react-query';

import { isIntentSuperseded, selectOptimisticIntents, toMutationSnapshot } from './intents';
import { type MutationOptions, useInvalidatingMutation } from './invalidate';

type ApplyUpdateFn<TResponse, TEntity> = (
	response: TResponse,
	update: (entity: TEntity) => TEntity,
) => TResponse;

/**
 * Creates an isolated optimistic-intent resource for one entity type
 * @remarks The query cache remains server-owned; pending intents are projected only into visible results
 */
export function createOptimisticResource<TEntity extends { readonly id: string }>({
	mutationKey,
	invalidates,
}: {
	mutationKey: MutationKey;
	invalidates: (entityId: string | undefined) => readonly QueryKey[];
}) {
	/** Resource-scoped optimistic intent */
	class Intent {
		constructor(readonly update: (entity: TEntity) => TEntity) {}
	}

	type OptimisticMutationOptions<TData, TError, TVariables> =
		// Extend default mutation options
		MutationOptions<TData, TError, TVariables, Intent> &
			(
				| { targetId: string; optimisticFn?: (entity: TEntity, variables: TVariables) => TEntity }
				| { targetId: undefined; optimisticFn?: never }
			);

	const isIntent = (ctx: unknown) => (ctx instanceof Intent ? ctx : undefined);

	const useIntents = () => {
		const mutations = useMutationState({
			filters: { exact: true, mutationKey },
			select: toMutationSnapshot,
		});

		return selectOptimisticIntents(mutations, isIntent);
	};

	const applyIntents = <TResponse>(
		response: TResponse,
		intents: readonly Intent[],
		applyFn: ApplyUpdateFn<TResponse, TEntity>,
	) => intents.reduce((current, intent) => applyFn(current, intent.update), response);

	/** Uses query selector to project optimistic intents, ahead of a caller select function
	 * @remarks Place this in a useQuery() to make it optimistic
	 */
	function useOptimisticSelect<TResponse, TData>(
		applyFn: ApplyUpdateFn<TResponse, TEntity>,
		select: (response: TResponse) => TData,
	): (response: TResponse) => TData;

	function useOptimisticSelect<TResponse, TData = TResponse>(
		applyFn: ApplyUpdateFn<TResponse, TEntity>,
		select?: (response: TResponse) => TData,
	): (response: TResponse) => TResponse | TData;

	function useOptimisticSelect<TResponse, TData = TResponse>(
		applyFn: ApplyUpdateFn<TResponse, TEntity>,
		select?: (response: TResponse) => TData,
	) {
		const intents = useIntents();

		return (response: TResponse) => {
			const overlaid = applyIntents(response, intents, applyFn);
			return select ? select(overlaid) : overlaid;
		};
	}

	/** @remarks Batches overlapping mutations, so that lifecycle callbacks are invoked only once per entity */
	function useOptimisticMutation<TData = unknown, TError = DefaultError, TVariables = void>({
		targetId,
		optimisticFn,
		...options
	}: OptimisticMutationOptions<TData, TError, TVariables>) {
		const scope = { id: hashKey([mutationKey, targetId, options.scope]) };

		const isSuperseded = (client: QueryClient, intent: Intent | undefined) =>
			isIntentSuperseded(
				client.getMutationCache().getAll().map(toMutationSnapshot),
				intent,
				isIntent,
			);

		return useInvalidatingMutation<TData, TError, TVariables, Intent>({
			...options,
			invalidates: invalidates(targetId),
			mutationKey,
			scope,

			// Settling promises that have been superseded must not surface a user-facing notification,
			// else responses will race

			onError: (error, variables, intent, context, ...args) => {
				if (isSuperseded(context.client, intent)) return;
				return options.onError?.(error, variables, intent, context, ...args);
			},
			onSuccess: (data, variables, intent, context, ...args) => {
				if (isSuperseded(context.client, intent)) return;
				return options.onSuccess?.(data, variables, intent, context, ...args);
			},
			onSettled: (data, error, variables, intent, context, ...args) => {
				if (isSuperseded(context.client, intent)) return;
				return options.onSettled?.(data, error, variables, intent, context, ...args);
			},
			onMutate: variables =>
				new Intent(entity =>
					entity.id === targetId ? (optimisticFn?.(entity, variables) ?? entity) : entity,
				),
		});
	}

	return { useOptimisticMutation, useOptimisticSelect };
}
