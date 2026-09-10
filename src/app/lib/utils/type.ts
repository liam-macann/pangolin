import { type PartialDeepOptions, type PartialDeep as TypeFestPartialDeep } from 'type-fest';

export type PartialDeep<
	T,
	C extends PartialDeepOptions = { recurseIntoArrays: true },
> = TypeFestPartialDeep<T, C>;

/** Validates that all items in an array are unique */
export type Unique<Tuple extends readonly unknown[]> = Tuple extends readonly [
	infer Head,
	...infer Tail,
]
	? Head extends Tail[number]
		? never
		: Unique<Tail> extends never
			? never
			: Tuple
	: Tuple;

/** Enforce a minimal representation of an object
 * @remarks Enforces empty arrays, and uses `null` and `undefined` values when allowed by the type */
export type Minimized<T> = {
	[K in keyof T]: null extends T[K]
		? null
		: undefined extends T[K]
			? undefined
			: T[K] extends unknown[]
				? []
				: T[K] extends
							| Date
							| Set<unknown>
							| Map<unknown, unknown>
							| ((...args: unknown[]) => unknown)
					? T[K]
					: T[K] extends object
						? Minimized<T[K]>
						: T[K];
};

export type {
	DistributedOmit,
	IterableElement as ElementType,
	Simplify,
	Tagged as Brand,
} from 'type-fest';
