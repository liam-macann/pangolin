import {
	type DefaultError,
	hashKey,
	type MutationKey,
	type MutationScope,
	type QueryKey,
	type UseMutationOptions,
	type UseMutationResult,
	type UseSuspenseQueryOptions,
	type UseSuspenseQueryResult,
	useMutation,
	useMutationState,
	useSuspenseQuery,
} from '@tanstack/react-query';

export type MutationOptions<TData, TError, TVariables, TContext = unknown> = Omit<
	UseMutationOptions<TData, TError, TVariables, TContext>,
	'onMutate' | 'mutationKey'
>;

/**
 * Selects optimistic intents from the mutation cache, in submission order.
 * Pending intents (and newer successes in the same scope) remain visible through refetch.
 */
type MutationState = {
	status: 'error' | 'idle' | 'pending' | 'success';
	mutationId: number;
	context: unknown;
	scope?: MutationScope;
};

export function selectOptimisticIntents<TIntent>(
	mutations: readonly MutationState[],
	getIntent: (context: unknown) => TIntent | undefined,
) {
	const related = mutations
		.map(mutation => ({
			intent: getIntent(mutation.context),
			mutationId: mutation.mutationId,
			scope: mutation.scope,
			status: mutation.status,
		}))
		.filter(
			(mutation): mutation is typeof mutation & { intent: TIntent } =>
				mutation.intent !== undefined,
		);

	/** A map; keyed by mutation scope, with value set to the first pending promise of that scope */
	const firstPending = related.reduce((acc, mutation) => {
		if (mutation.status === 'pending')
			acc.set(
				mutation.scope?.id,
				Math.min(acc.get(mutation.scope?.id) ?? Number.POSITIVE_INFINITY, mutation.mutationId),
			);

		return acc;
	}, new Map<string | undefined, number>());

	// A newer successful mutation must stay overlaid until every earlier mutation in its scope settles;
	// otherwise its intent briefly disappears while the awaited refetch is still in flight
	return (
		related
			.filter(mutation => {
				/** ID of the first pending promise in the scope */
				const boundary = firstPending.get(mutation.scope?.id) ?? Number.POSITIVE_INFINITY;

				return (
					// All intents after the first pending are retained, even if already settled
					mutation.mutationId >= boundary &&
					// Failed mutations are filtered out
					(mutation.status === 'pending' || mutation.status === 'success')
				);
			})
			// Mutation IDs increment monotonically by creation time
			.sort((left, right) => left.mutationId - right.mutationId)
			.map(mutation => mutation.intent)
	);
}

/** Whether a newer pending intent in the same mutation scope supersedes this intent */
export function isIntentSuperseded<TIntent>(
	mutations: readonly MutationState[],
	intent: TIntent | undefined,
	getIntent: (context: unknown) => TIntent | undefined,
) {
	if (intent === undefined) return false;

	// Find the mutation that owns the visible intent
	const mutation = mutations.find(candidate => candidate.context === intent);
	if (!mutation) return false;

	/** Whether a newer pending mutation in the same scope owns the visible intent */
	return mutations.some(
		candidate =>
			candidate.mutationId > mutation.mutationId &&
			candidate.scope?.id === mutation.scope?.id &&
			candidate.status === 'pending' &&
			getIntent(candidate.context) !== undefined,
	);
}

function useOptimisticIntents<TIntent>(
	mutationKey: MutationKey,
	getIntent: (context: unknown) => TIntent | undefined,
) {
	const mutations = useMutationState<MutationState>({
		filters: { exact: true, mutationKey },
		select: mutation => ({
			context: mutation.state.context,
			mutationId: mutation.mutationId,
			scope: mutation.options.scope,
			status: mutation.state.status,
		}),
	});

	return selectOptimisticIntents(mutations, getIntent);
}

/**
 * Creates an isolated optimistic overlay type and a suspense-query wrapper bound to that entity.
 * @remarks The wrapper replays intents over server data; the cache always reflects a server response.
 */
export function createOptimisticResource<TEntity extends { readonly id: string }>({
	mutationKey,
	invalidates,
}: {
	mutationKey: MutationKey;
	invalidates: (entityId: string | undefined) => readonly QueryKey[];
}) {
	class Intent {
		constructor(readonly update: (entity: TEntity) => TEntity) {}
	}

	const getIntent = (context: unknown): Intent | undefined =>
		context instanceof Intent ? context : undefined;

	function useOptimisticQuery<TResponse, TData = TResponse>(
		options: UseSuspenseQueryOptions<TResponse, DefaultError, TData>,
		apply: (response: TResponse, update: (entity: TEntity) => TEntity) => TResponse,
	): UseSuspenseQueryResult<TData, DefaultError>;

	function useOptimisticQuery<TResponse, TData>(
		options: UseSuspenseQueryOptions<TResponse, DefaultError, TData>,
		/** An adapter callback that specifies how to merge optimistic intents with the response */
		apply: (response: TResponse, update: (entity: TEntity) => TEntity) => TResponse,
	) {
		const intents = useOptimisticIntents(mutationKey, getIntent);
		const select = options.select;

		return useSuspenseQuery({
			...options,
			select: response => {
				// Derive the visible value without changing the query cache, which always reflects server state
				const overlaid = intents.reduce(
					(current, intent) => apply(current, intent.update),
					response,
				);

				// Applying the caller select last makes it observe the same optimistic value
				return select ? select(overlaid) : overlaid;
			},
		});
	}

	function useOptimisticMutation<TData = unknown, TError = DefaultError, TVariables = void>(
		entityId: undefined,
		options: MutationOptions<TData, TError, TVariables, Intent>,
		optimistic?: never,
	): UseMutationResult<TData, TError, TVariables, Intent>;

	function useOptimisticMutation<TData = unknown, TError = DefaultError, TVariables = void>(
		entityId: string,
		options: MutationOptions<TData, TError, TVariables, Intent>,
		optimistic?: (entity: TEntity, variables: TVariables) => TEntity,
	): UseMutationResult<TData, TError, TVariables, Intent>;

	/** @remarks Batches overlapping mutations, so that lifecycle callbacks are invoked only once per entity */
	function useOptimisticMutation<TData = unknown, TError = DefaultError, TVariables = void>(
		entityId: string | undefined,
		options: MutationOptions<TData, TError, TVariables, Intent>,
		optimistic?: (entity: TEntity, variables: TVariables) => TEntity,
	) {
		const scope = { id: hashKey([mutationKey, entityId, options.scope]) };

		const getMutationStates = (
			client: Parameters<NonNullable<typeof options.onError>>[3]['client'],
		) =>
			client
				.getMutationCache()
				.getAll()
				.map(mutation => ({
					context: mutation.state.context,
					mutationId: mutation.mutationId,
					scope: mutation.options.scope,
					status: mutation.state.status,
				}));

		return useInvalidatingMutation<TData, TError, TVariables, Intent>(
			{
				...options,
				mutationKey,
				// Superseded failures must not surface as a user-facing error
				onError: (error, variables, intent, context, ...args) => {
					if (isIntentSuperseded(getMutationStates(context.client), intent, getIntent)) return;
					return options.onError?.(error, variables, intent, context, ...args);
				},
				onSuccess: (data, variables, intent, context, ...args) => {
					if (isIntentSuperseded(getMutationStates(context.client), intent, getIntent)) return;
					return options.onSuccess?.(data, variables, intent, context, ...args);
				},
				onSettled: (data, error, variables, intent, context, ...args) => {
					if (isIntentSuperseded(getMutationStates(context.client), intent, getIntent)) return;
					return options.onSettled?.(data, error, variables, intent, context, ...args);
				},
				onMutate: variables =>
					new Intent(entity =>
						entity.id === entityId ? (optimistic?.(entity, variables) ?? entity) : entity,
					),
				scope,
			},
			invalidates(entityId),
		);
	}

	return { useOptimisticMutation, useOptimisticQuery };
}

/** Creates a mutation that awaits related query invalidation after success */
export function useInvalidatingMutation<TData, TError, TVariables, TContext>(
	options: UseMutationOptions<TData, TError, TVariables, TContext>,
	queryKeys: readonly QueryKey[],
) {
	return useMutation({
		...options,
		onSuccess: async (data, variables, mutationResult, context, ...args) => {
			try {
				await options.onSuccess?.(data, variables, mutationResult, context, ...args);
			} finally {
				await Promise.allSettled(
					queryKeys.map(queryKey => context.client.invalidateQueries({ queryKey })),
				);
			}
		},
	});
}
