import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { concatBytes, equalBytes, managedNonce } from '@noble/ciphers/utils.js';

import { header, version } from '@/lib/encrypt/constants';
import { type Encrypted, isEncrypted, toBytes } from '@/lib/utils/encrypt';

export const encoder = new TextEncoder();
// Keep a leading BOM, which would be part of the encrypted plaintext, not an encoding marker.
// Throw on invalid UTF-8 rather than silently continuing.
export const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
/** @internal */
export const chacha = managedNonce(xchacha20poly1305);

type Passthrough =
	| Date
	| RegExp
	| Error
	| URL
	| ArrayBuffer
	| ArrayBufferView
	| ((...args: never) => unknown);

// biome-ignore format: Nested conditions easier to read when flat
/** @internal */
export type Decrypted<T> =
	T extends Encrypted ? string :
	T extends Passthrough ? T :
	T extends Promise<infer U> ? Promise<U> :
	T extends ReadonlyArray<infer U> ? Decrypted<U>[] :
	T extends Array<infer U> ? Decrypted<U>[] :
	T extends Set<infer U> ? Set<Decrypted<U>> :
	T extends Map<infer K, infer U> ? Map<Decrypted<K>, Decrypted<U>> :
	T extends object ? { [K in keyof T]: Decrypted<T[K]> } :
	T;

/** Idempotent header and version concatenation
 * @internal */
export const concatHeader = (ciphertext: Uint8Array): Encrypted<Uint8Array> =>
	isEncrypted(ciphertext)
		? ciphertext
		: (concatBytes(header, version, ciphertext) as Encrypted<Uint8Array>);

/** Header removal
 * @internal */
export const stripHeader = (ciphertext: Encrypted): Uint8Array => {
	if (!isEncrypted(ciphertext)) throw new Error('Missing encryption header');

	const bytes = toBytes(ciphertext);
	const offset = header.length + version.length;

	// The version byte is not authenticated by the cipher, so it must be checked explicitly
	if (!equalBytes(bytes.subarray(header.length, offset), version))
		throw new Error('Unsupported encryption version');

	return bytes.subarray(offset);
};
