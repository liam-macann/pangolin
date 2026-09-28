import { isPlainObject } from 'es-toolkit';

import { type Synchronous } from '@/lib/utils';

import { type Decrypted, Encrypted } from './types';

export type DeepDecryptable =
	| Record<string, unknown>
	| Map<unknown, unknown>
	| ReadonlyMap<unknown, unknown>
	| Set<unknown>
	| ReadonlySet<unknown>
	| readonly unknown[];

/** Walks supported collections and plain objects, replacing encrypted values. */
export function decryptDeep<T extends DeepDecryptable>(
	input: T,
	decrypt: (value: Encrypted) => string,
): Synchronous<Decrypted<T>> {
	// Maps each visited object to decrypted output, to resolve shared and circular references
	const seen = new WeakMap<object, unknown>();

	function walker(input: unknown): unknown {
		if (input === null || input === undefined || typeof input === 'function') return input;

		if (input instanceof Encrypted) return decrypt(input);

		if (typeof input === 'object') {
			const visited = seen.get(input);
			if (visited) return visited;

			// Each output is registered before its children are walked, so a cycle can reach it

			if (Array.isArray(input)) {
				const output = new Array(input.length);
				seen.set(input, output);

				input.forEach((value, index) => {
					output[index] = walker(value);
				});

				return output;
			}

			if (input instanceof Set) {
				const output = new Set();
				seen.set(input, output);

				input.forEach(value => void output.add(walker(value)));

				return output;
			}

			if (input instanceof Map) {
				const output = new Map();
				seen.set(input, output);

				input.forEach((value, key) => void output.set(walker(key), walker(value)));

				return output;
			}

			// Catches Date, RegExp, Error, URL, Buffers, Promise, BigInt, boxed primitives, Blob, etc.
			if (!isPlainObject(input)) return input;

			// Respect the input prototype (either Object.prototype or null)
			const output: object = Object.create(Object.getPrototypeOf(input));
			seen.set(input, output);

			// Include all enumerable keys, including symbols (which Object.entries() skips)
			Reflect.ownKeys(input)
				.filter(key => Object.prototype.propertyIsEnumerable.call(input, key))
				.forEach(key => {
					// Object.defineProperty prevents __proto__ from calling the prototype setter
					Object.defineProperty(output, key, {
						value: walker(Reflect.get(input, key)),
						enumerable: true,
						writable: true,
						configurable: true,
					});
				});

			return output;
		}

		return input;
	}

	return walker(input) as Synchronous<Decrypted<T>>;
}
