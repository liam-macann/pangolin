import { type Mutation, type MutationScope } from '@tanstack/react-query';

/** Projects the mutation-cache state used by optimistic intent selection */
export const toMutationSnapshot = (mutation: Mutation) => ({
	context: mutation.state.context,
	mutationId: mutation.mutationId,
	scope: mutation.options.scope,
	status: mutation.state.status,
});

type OptimisticMutationSnapshot = Omit<ReturnType<typeof toMutationSnapshot>, 'scope'> & {
	scope?: MutationScope;
};

/**
 * Selects optimistic intents from the mutation cache, in submission order.
 * Pending intents (and newer successes in the same scope) remain visible through refetch.
 */
export function selectOptimisticIntents<TIntent>(
	mutations: readonly OptimisticMutationSnapshot[],
	isIntent: (context: unknown) => TIntent | undefined,
) {
	const related = mutations
		.map(mutation => ({
			intent: isIntent(mutation.context),
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
	mutations: readonly OptimisticMutationSnapshot[],
	intent: TIntent | undefined,
	/** Whether a context matches an intent. Intents are entity-bound, so consumers must disambiguate. */
	isIntent: (context: unknown) => TIntent | undefined,
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
			isIntent(candidate.context) !== undefined,
	);
}
