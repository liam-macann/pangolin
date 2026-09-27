import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { isPlainObject } from 'es-toolkit';
import { forbidden, unauthorized } from 'next/navigation';

import { type Brand } from '@/lib/utils';

import { getSession } from '@/auth';

import { chacha, decoder, encoder, VERSION } from './internal/cipher';
import { retrieveDEK } from './internal/keys';
import { type Decrypted, Encrypted } from './internal/types';

export type { Encrypted };

/** Encrypts a string using the provided Data Encryption Key (DEK)
 * @internal */
function encrypt(value: string, DEK: Uint8Array): Encrypted {
	const data = encoder.encode(value);
	return new Encrypted(chacha(DEK).encrypt(data));
}

/** Decrypts an Encrypted string using the provided Data Encryption Key (DEK)
 * @internal */
function decrypt(value: Encrypted, DEK: Uint8Array): string {
	try {
		if (value.version !== VERSION) throw new Error('Unsupported encryption version');

		const bytestream = chacha(DEK).decrypt(value.bytes);
		const plaintext = decoder.decode(bytestream);

		return plaintext;
	} catch {
		// Avoid leaking errors
		throw new Error('Failed to decrypt input');
	}
}

/** Retrieves and unwraps the Data Encryption Key (DEK) for an authenticated user */
async function crypto(uuid: string) {
	let destroyed = false;
	const DEK = await retrieveDEK(uuid);

	const destroy = () => {
		DEK.fill(0);
		destroyed = true;
	};

	const checkDestroyed = () => {
		if (destroyed) throw new Error('DEK has been destroyed');
	};

	const auth = async <T>(fn: () => T) => {
		checkDestroyed();
		const session = (await getSession()) ?? unauthorized();

		// Explicit about which user DEK is requested
		if (session?.user.id !== uuid) {
			destroy();
			forbidden();
		}

		// The vault may have been destroyed while awaiting the session, which would run crypto with a zeroed DEK
		checkDestroyed();

		return fn();
	};

	function _encrypt(args: string): Promise<Encrypted>;
	function _encrypt(args: string[]): Promise<Encrypted[]>;
	async function _encrypt(args: string | string[]) {
		return auth(() =>
			Array.isArray(args) ? args.map(arg => encrypt(arg, DEK)) : encrypt(args, DEK),
		);
	}

	function _decrypt(args: Encrypted): Promise<string>;
	function _decrypt(args: Encrypted[]): Promise<string[]>;
	async function _decrypt(args: Encrypted | Encrypted[]) {
		return auth(() =>
			Array.isArray(args) ? args.map(arg => decrypt(arg, DEK)) : decrypt(args, DEK),
		);
	}

	const _decryptDeep = async <
		T extends Record<string, unknown> | Map<unknown, unknown> | unknown[],
	>(
		input: T,
	): Promise<Decrypted<T>> =>
		auth(() => {
			// Maps each visited object to decrypted output, to resolve shared and circular references
			const seen = new WeakMap<object, unknown>();

			function walker(input: unknown): unknown {
				if (input === null || input === undefined || typeof input === 'function') return input;

				// Decrypts with DEK directly, rather than through _decrypt(), to prevent recursively calling auth().
				// Authentication is handled once, in the enclosing auth().
				if (input instanceof Encrypted) return decrypt(input, DEK);

				if (typeof input === 'object') {
					const visited = seen.get(input);
					if (visited) return visited;

					// Each output is registered before its children are walked, so a cycle can reach it

					// Input is an array
					if (Array.isArray(input)) {
						const output = new Array(input.length);
						seen.set(input, output);

						input.forEach((value, index) => {
							output[index] = walker(value);
						});

						return output;
					}

					// Input is a Set
					if (input instanceof Set) {
						const output = new Set();
						seen.set(input, output);

						input.forEach(value => void output.add(walker(value)));

						return output;
					}

					// Input is a Map
					if (input instanceof Map) {
						const output = new Map();
						seen.set(input, output);

						input.forEach((value, key) => void output.set(walker(key), walker(value)));

						return output;
					}

					// Catches Date, RegExp, Error, URL, Buffers, Promise, BigInt, boxed primitives, Blob, etc.
					if (!isPlainObject(input)) return input;

					// Input is a plain object; respect input prototype (either Object.prototype or null)
					const output: object = Object.create(Object.getPrototypeOf(input));
					seen.set(input, output);

					// Include all enumerable keys, including symbols (which Object.entries() skips)
					Reflect.ownKeys(input)
						.filter(key => Object.prototype.propertyIsEnumerable.call(input, key))
						.forEach(key => {
							// Object.defineProperty used so that __proto__ does not call prototype setter
							Object.defineProperty(output, key, {
								value: walker(Reflect.get(input, key)),
								enumerable: true,
								writable: true,
								configurable: true,
							});
						});

					return output;
				}

				// Other values are returned as-is
				return input;
			}

			return walker(input) as Decrypted<T>;
		});

	const vault = {
		/** Encrypts a string or array of strings into Encrypted values */
		encrypt: _encrypt,
		/** Decrypts Encrypted values, returning a string or array of strings */
		decrypt: _decrypt,
		/** Walks through a array, Map, or plain object; decrypting any encrypted values */
		decryptObject: _decryptObject,
		/** Clear the internal DEK from memory */
		destroy,
	};

	return vault as Brand<typeof vault, 'Vault'>;
}

/** A crypto vault handles encryption and decryption, retrieving and unwrapping the DEK for a given user.
 * @remarks Unsafe, as the caller must manage `destroy()`. */
type UnsafeVault = Awaited<ReturnType<typeof crypto>>;

/** A crypto vault passed to a {@link withVault()} callback.
 * @remarks The DEK is automatically destroyed when the scope exits. */
export type Vault = Omit<UnsafeVault, 'destroy'>;

/** Allows any type except {@link Vault}
 * @remarks This is just a fail-fast error that catches the basic case at compile time.
 * The DEK will still be destroyed once the scope exits, so accessing the vault outside will throw. */
type NoVault<T> = T extends Vault ? never : { [K in keyof T]: NoVault<T[K]> };

/** Allows nested `withVault()` calls to reuse the outer vault instead of unwrapping the DEK again. */
const vaultContext = new AsyncLocalStorage<{ vault: Vault; userId: string; open: boolean }>();

/** Resolves the active session, then passes a crypto vault to the callback.
 * The key is destroyed once the outermost callback settles. */
export async function withVault<T>(
	callback: (vault: Vault) => Promise<T & NoVault<T>>,
): Promise<T> {
	const inherited = vaultContext.getStore();
	// Decide ownership before authentication yields, so a nested call is always inherited
	const borrowed = inherited?.open ? inherited : undefined;
	const session = (await getSession()) ?? unauthorized();

	if (borrowed) {
		// Only the outermost scope owns the DEK; a different user must never reuse it.
		// Refused before the vault is handed out, so the outer scope remains valid.
		if (borrowed.userId !== session.user.id) forbidden();
		if (!borrowed.open) throw new Error('Vault scope has closed');
		return callback(borrowed.vault);
	}

	// Work invoked after an outer scope closes inherits its context but owns a fresh vault.
	const { destroy, ...vault } = await crypto(session.user.id);
	const store = { vault, userId: session.user.id, open: true };

	try {
		return await vaultContext.run(store, () => callback(vault));
	} finally {
		store.open = false;
		destroy();
	}
}
