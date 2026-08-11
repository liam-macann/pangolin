'use client';

import {
	type Cache,
	type MutatorCallback,
	type MutatorOptions,
	type ScopedMutator,
	useSWRConfig,
} from 'swr';

type MutationResult<T> = T | undefined | ReturnType<() => void>;

/** Mirrors the signature of {@link KeyedMutator}, but simultaneously mutates related keys and returns an array of the results */
export type GangedMutator<T> = (
	data?: T | Promise<MutationResult<T>> | MutatorCallback<T>,
	opts?: MutatorOptions<T, T | undefined>,
) => Promise<PromiseSettledResult<T | undefined>[]>;

type Identifiable = { id: string };

/** Mutates a whole-object key, rolling back to its previous value on failure */
function mutateDetail<T extends Identifiable>(
	mutate: ScopedMutator,
	cache: Cache,
	key: string,
	...args: Parameters<GangedMutator<T>>
) {
	const [data, opts] = args;
	const patch = opts?.optimisticData;
	const resolvedData = data instanceof Promise ? data.then(value => value ?? undefined) : data;

	/** The cache value from just before this optimistic write; restored on rollback */
	let previous: T | undefined;
	/** The value this mutation wrote optimistically */
	let written: T | undefined;

	const promise = mutate<T, T | undefined>(
		key,
		(current: T | undefined) =>
			typeof resolvedData === 'function' ? resolvedData(current) : resolvedData,
		{
			...opts,
			optimisticData: patch
				? (current, displayed) => {
						previous = displayed ?? current;
						written = typeof patch === 'function' ? patch(current, displayed) : patch;
						return written;
					}
				: undefined,
			rollbackOnError: false,
		},
	);

	promise.catch(err => {
		const rollbackOnError = opts?.rollbackOnError;
		if (
			!patch ||
			(typeof rollbackOnError === 'function' && !rollbackOnError(err)) ||
			rollbackOnError === false
		)
			return;
		if (cache.get(key)?.data !== written) return; // Superseded by a newer write

		mutate(key, previous, { revalidate: false });
	});

	return promise;
}

/** Mutates one item within a list key, without touching other pending optimistic rows */
function mutateListItem<T extends Identifiable>(
	mutate: ScopedMutator,
	cache: Cache,
	key: string,
	id: string,
	...args: Parameters<GangedMutator<T>>
) {
	const [data, opts] = args;
	const patch = opts?.optimisticData;
	const resolvedData = data instanceof Promise ? data.then(value => value ?? undefined) : data;

	/** The cache item value from just before this optimistic write; restored on rollback */
	let previous: T | undefined;
	/** The value this mutation wrote optimistically */
	let written: T | undefined;
	const items: T[] | undefined = cache.get(key)?.data;

	const promise = mutate<T[], T | undefined>(
		key,
		typeof resolvedData === 'function'
			? resolvedData(items?.find(item => item.id === id))
			: resolvedData,
		{
			...opts,
			revalidate: (items: T[] | undefined, key) => {
				const revalidate = opts?.revalidate;
				if (typeof revalidate !== 'function') return revalidate ?? true;

				const item = items?.find(i => i.id === id);
				return item ? revalidate(item, key) : true;
			},
			optimisticData: patch
				? (current, displayed) => {
						const base = displayed ?? current;
						if (!base) return [];

						previous = base.find(item => item.id === id);
						const next =
							typeof patch === 'function'
								? patch(
										current?.find(item => item.id === id),
										displayed?.find(item => item.id === id),
									)
								: patch;
						written = next;

						return base.flatMap(item => (item.id === id ? (next ?? []) : item));
					}
				: undefined,
			// Replace only the matching item with resolved data,
			// leaving the rest of the array untouched (including pending optimistic writes on other items)
			populateCache: (result, items) => {
				const value = result ?? written;
				const existing = items ?? [];
				if (!existing.some(item => item.id === id)) return value ? [...existing, value] : existing;
				return existing.map(item => (item.id === id ? (value ?? item) : item));
			},
			rollbackOnError: false,
		},
	);

	promise.catch(err => {
		const rollbackOnError = opts?.rollbackOnError;
		if (
			!patch ||
			(typeof rollbackOnError === 'function' && !rollbackOnError(err)) ||
			rollbackOnError === false
		)
			return;

		const current: T[] | undefined = cache.get(key)?.data;
		if (!current || current.find(item => item.id === id) !== written) return; // Skip if a newer write updated this item

		mutate(
			key,
			current.map(item => (item.id === id ? previous : item)),
			{ revalidate: false },
		);
	});

	return promise;
}

//
// Factory

/** Factory for hooks that mutate a set of related SWR keys together */
export function createMutation<T extends Identifiable>(...keys: KeySpec[]) {
	return function useMutation(id: string) {
		const { mutate, cache } = useSWRConfig();

		const fn: GangedMutator<T> = (...args) => {
			const [data, opts] = args;

			// Resolve every key against the pre-mutation cache before touching any of them, so a
			// later lookup (e.g. deriving a related id) can't see an earlier optimistic write
			const resolved = keys.flatMap(({ scope, key: resolve }) => {
				const key = resolve(id, cache);
				return key ? [{ scope, key }] : [];
			});

			// If no data is provided, mutate simply triggers revalidation
			if (data === undefined) return Promise.allSettled(resolved.map(({ key }) => mutate(key)));

			return Promise.allSettled(
				resolved.map(({ scope, key }) =>
					scope === 'list'
						? mutateListItem<T>(mutate, cache, key, id, data, opts)
						: mutateDetail<T>(mutate, cache, key, data, opts),
				),
			);
		};

		return { mutate: fn };
	};
}

//
// Key declarations

type KeySpec = {
	scope: 'detail' | 'list';
	key: (id: string, cache: Cache) => string | undefined;
};

/** A key holding a single entity (`T`), mutated and rolled back as a whole */
export const detail = (key: (id: string) => string): KeySpec => ({ scope: 'detail', key });

/** A key holding an entity array (`T[]`); only the item matching `id` is mutated/rolled back */
export const list = (key: (id: string, cache: Cache) => string | undefined): KeySpec => ({
	scope: 'list',
	key,
});
