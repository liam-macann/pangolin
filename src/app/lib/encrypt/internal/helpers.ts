import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
	bytesToHex,
	concatBytes,
	equalBytes,
	hexToBytes,
	managedNonce,
} from '@noble/ciphers/utils.js';

import { header, version } from './constants';
import { type Encrypted } from './types';

export const encoder = new TextEncoder();
// Keep a leading BOM, which would be part of the encrypted plaintext, not an encoding marker.
// Throw on invalid UTF-8 rather than silently continuing.
export const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

/** @internal */
export const chacha = managedNonce(xchacha20poly1305);

/** Allows idempotent encoding regardless of encryption status.
 * @remarks Preserves branded {@link Encrypted} output if input is branded. */
export function toHex(value: Encrypted): Encrypted<string>;
export function toHex(value: string | Uint8Array): string;
export function toHex(value: Encrypted | string | Uint8Array) {
	return typeof value !== 'string' ? bytesToHex(value) : value;
}

/** Allows idempotent encoding regardless of encryption status.
 * @remarks Preserves branded {@link Encrypted} output if input is branded. */
export function toBytes(value: Encrypted): Encrypted<Uint8Array>;
export function toBytes(value: string | Uint8Array): Uint8Array;
export function toBytes(value: Encrypted | string | Uint8Array) {
	return typeof value === 'string' ? hexToBytes(value) : value;
}

const HEADER_HEX = bytesToHex(header);

/** Checks for the magic header, in either byte or hex form */
export const isEncrypted = <T extends string | Uint8Array>(value: T): value is Encrypted<T> => {
	const hex = typeof value === 'string' ? value : bytesToHex(value.subarray(0, header.length));
	return hex.startsWith(HEADER_HEX);
};

/** Prepends the encryption header and version to raw ciphertext.
 * @internal */
export const concatHeader = (ciphertext: Uint8Array): Encrypted<Uint8Array> =>
	concatBytes(header, version, ciphertext) as Encrypted<Uint8Array>;

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
