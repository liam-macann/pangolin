import 'server-only';

import { forbidden, unauthorized } from 'next/navigation';

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
 * @internal
 */
function encrypt(value: string, DEK: Uint8Array): Encrypted<string> {
	const data = encoder.encode(value);
	const ciphertext = chacha(DEK).encrypt(data);
	return toHex(concatHeader(ciphertext));
}

/** Decrypts an Encrypted string using the provided Data Encryption Key (DEK)
 * @internal
 */
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
export async function crypto(uuid: string) {
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

	const _decryptObject = async <T extends Record<string, unknown> | Map<unknown, unknown>>(
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

					if (
						input instanceof Date ||
						input instanceof RegExp ||
						input instanceof Error ||
						input instanceof URL ||
						input instanceof ArrayBuffer ||
						input instanceof Promise ||
						// Int32Array, Float64Array, DataView, etc.
						ArrayBuffer.isView(input)
					) {
						return input;
					}

					// Input is an array
					if (Array.isArray(input)) return await Promise.all(input.map(walker));

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

	return {
		/** Encrypts into array of ciphertext */
		encrypt: _encrypt,
		/** Decrypts ciphertext, returning an array of strings */
		decrypt: _decrypt,
		/** Walks through an object, decrypting any encrypted values */
		decryptObject: _decryptObject,
		/** Clear the internal DEK from memory */
		destroy,
	};
}
