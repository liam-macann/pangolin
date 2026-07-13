import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export type ElementType<T extends Iterable<unknown>> = T extends Iterable<infer E> ? E : never;

/** Improve readability of object types */
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

/**
 * Ensures that all objects in a tuple share the **exact same keys**.
 *
 * @template T - A arbitrary-length tuple of objects `[object, object, …]`
 */
export type AllSameKeys<T extends [object, ...object[]]> = T extends [
	infer First extends object,
	...infer Rest extends object[],
]
	? Rest[number] extends First
		? First extends Rest[number]
			? T
			: never
		: never
	: never;

/** Omit properties without breaking discriminated unions */
export type OmitUnion<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** Deeply partialize an object type */
export type DeepPartial<T> = T extends Date | Set<unknown> | Map<unknown, unknown>
	? T
	: T extends object
		? {
				[P in keyof T]?: DeepPartial<T[P]>;
			}
		: T;

/** Enforce a minimal representation of an object
 *
 * @remarks Enforces empty arrays, and uses `null` and `undefined` values when allowed by the type
 */
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

declare const __brand: unique symbol;
/** Simulate nominal typing by specifying a key */
export type Brand<T, B> = T & { [__brand]: B };
