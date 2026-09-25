import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
	bytesToHex,
	concatBytes,
	equalBytes,
	hexToBytes,
	managedNonce,
} from '@noble/ciphers/utils.js';

import { HEADER, MIN_LENGTH, VERSION } from './constants';
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

const PREFIX = concatBytes(HEADER, VERSION);
const PREFIX_HEX = bytesToHex(PREFIX).toLowerCase();
const isHex = /^(?:[0-9a-f]{2})+$/i;

/** Checks for well-formed ciphertext of the current version, in either byte or hex form. */
export const isEncrypted = <T extends string | Uint8Array>(value: T): value is Encrypted<T> => {
	if (typeof value !== 'string')
		// Bytes are checked directly, rather than hex-encoding the whole buffer
		return value.length >= MIN_LENGTH && equalBytes(value.subarray(0, PREFIX.length), PREFIX);

	// Hex encodes each byte as 2 characters
	const MIN_HEX_LENGTH = MIN_LENGTH * 2;

	// Case-insensitive prefix. Lowercases only the prefix to avoid copying the whole string.
	const prefix = value.slice(0, PREFIX_HEX.length).toLowerCase();

	return value.length >= MIN_HEX_LENGTH && prefix === PREFIX_HEX && isHex.test(value);
};

/** Prepends the encryption header and version to raw ciphertext.
 * @internal */
export const concatHeader = (ciphertext: Uint8Array): Encrypted<Uint8Array> =>
	concatBytes(HEADER, VERSION, ciphertext) as Encrypted<Uint8Array>;

/** Header removal
 * @internal */
export const stripHeader = (ciphertext: Encrypted): Uint8Array => {
	// Also verifies the version byte, which the cipher does not authenticate
	if (!isEncrypted(ciphertext)) throw new Error('Invalid ciphertext');
	return toBytes(ciphertext).subarray(HEADER.length + VERSION.length);
};
