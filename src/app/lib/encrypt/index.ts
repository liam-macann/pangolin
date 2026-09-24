import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { isPlainObject } from 'es-toolkit';
import { forbidden, unauthorized } from 'next/navigation';

import { type Brand } from '@/lib/utils';
import { type Encrypted, isEncrypted, toHex } from '@/lib/utils/encrypt';

import { getSession } from '@/auth';

import {
	chacha,
	concatHeader,
	type Decrypted,
	decoder,
	encoder,
	stripHeader,
} from './internal/helpers';
import { retrieveDEK } from './internal/keys';

export type { Decrypted };

/** Encrypts a string using the provided Data Encryption Key (DEK)
 * @internal */
function encrypt(value: string, DEK: Uint8Array): Encrypted<string> {
	const data = encoder.encode(value);
	const ciphertext = chacha(DEK).encrypt(data);
	return toHex(concatHeader(ciphertext));
}

/** Decrypts an Encrypted string using the provided Data Encryption Key (DEK)
 * @internal */
function decrypt(value: Encrypted, DEK: Uint8Array): string {
	try {
		const ciphertext = stripHeader(value);
		const bytestream = chacha(DEK).decrypt(ciphertext);
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

	const auth = async <T>(fn: () => T) => {
		if (destroyed) throw new Error('DEK has been destroyed');
		const session = (await getSession()) ?? unauthorized();

		// Explicit about which user DEK is requested
		if (session?.user.id !== uuid) {
			destroy();
			forbidden();
		}

		// The vault may have been destroyed while awaiting the session, which would run crypto with a zeroed DEK
		if (destroyed) throw new Error('DEK has been destroyed');

		return fn();
	};

	function _encrypt(args: string): Promise<Encrypted<string>>;
	function _encrypt(args: string[]): Promise<Encrypted<string>[]>;
	async function _encrypt(args: string | string[]) {
		return auth(() =>
			Array.isArray(args) ? args.map(arg => encrypt(arg, DEK)) : encrypt(args, DEK),
		);
	}

	function _decrypt<T extends string | Uint8Array>(args: Encrypted<T>): Promise<string>;
	function _decrypt<T extends string | Uint8Array>(args: Encrypted<T>[]): Promise<string[]>;
	async function _decrypt(args: Encrypted | Encrypted[]) {
		return auth(() =>
			Array.isArray(args) ? args.map(arg => decrypt(arg, DEK)) : decrypt(args, DEK),
		);
	}

	const _decryptObject = async <
		T extends Record<string, unknown> | Map<unknown, unknown> | unknown[],
	>(
		input: T,
	): Promise<Decrypted<T>> =>
		auth(() => {
			// Prevent circular references
			const seen = new WeakSet();

			async function walker(input: unknown): Promise<unknown> {
				if (input === null || input === undefined || typeof input === 'function') return input;

				// Input is a Uint8Array or string; decrypt if encrypted
				if (input instanceof Uint8Array || typeof input === 'string') {
					return isEncrypted(input) ? _decrypt(input) : input;
				}

				if (typeof input === 'object') {
					if (seen.has(input)) return input;
					seen.add(input);

					// Input is an array
					if (Array.isArray(input)) {
						const output = new Array(input.length);

						await Promise.all(
							input.map(async (value, index) => (output[index] = await walker(value))),
						);

						return output;
					}

					// Input is a Set
					if (input instanceof Set)
						return new Set(await Promise.all(Array.from(input).map(walker)));

					// Input is a Map
					if (input instanceof Map) {
						const entries = Array.from(input.entries()).map(
							async ([key, value]) =>
								[
									key instanceof Promise ? key : await walker(key),
									value instanceof Promise ? value : await walker(value),
								] as const,
						);

						return new Map(await Promise.all(entries));
					}

					// Catches Date, RegExp, Error, URL, Buffers, Promise, BigInt, boxed primitives, Blob, etc.
					if (!isPlainObject(input)) return input;

					// Input is an object
					return Object.fromEntries(
						await Promise.all(
							Object.entries(input).map(
								async ([key, value]) =>
									[key, value instanceof Promise ? value : await walker(value)] as const,
							),
						),
					);
				}

				// Other values are returned as-is
				return input;
			}

			return walker(input) as Promise<Decrypted<T>>;
		});

	const destroy = () => {
		DEK.fill(0);
		destroyed = true;
	};

	const vault = {
		/** Encrypts into array of ciphertext */
		encrypt: _encrypt,
		/** Decrypts ciphertext, returning an array of strings */
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
