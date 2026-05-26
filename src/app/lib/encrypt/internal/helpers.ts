import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { concatBytes, managedNonce } from '@noble/ciphers/utils.js';

import { header, version } from '@/lib/encrypt/constants';
import { type Encrypted, isEncrypted } from '@/lib/utils/encrypt';

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();
/** @internal */
export const chacha = managedNonce(xchacha20poly1305);

// biome-ignore format: Nested conditions easier to read when flat
/** @internal */
export type Decrypted<T> =
	T extends Encrypted ? string :
	T extends Array<infer U> ? Decrypted<U>[] :
	T extends Set<infer U> ? Set<Decrypted<U>> :
	T extends Map<infer K, infer U> ? Map<Decrypted<K>, Decrypted<U>> :
	T extends object ? { [K in keyof T]: Decrypted<T[K]> } :
	T;

/** Idempotent header concatenation
 * @internal */
export const concatHeader = (ciphertext: Uint8Array): Encrypted =>
	isEncrypted(ciphertext) ? ciphertext : (concatBytes(header, version, ciphertext) as Encrypted);

/** Idempotent header removal
 * @internal */
export const stripHeader = (ciphertext: Uint8Array): Uint8Array =>
	isEncrypted(ciphertext) ? ciphertext.slice(header.length + version.length) : ciphertext;
