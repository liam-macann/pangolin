import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { managedNonce } from '@noble/ciphers/utils.js';
import { type IntRange } from 'type-fest';

/** An integer that fits in a single byte */
export type Version = IntRange<0, 256>;

/**
 * Magic header to identify encrypted data in bytestream format.
 * @internal
 */
export const HEADER = new Uint8Array([0x43, 0x52, 0x59]); // CRY

/**
 * Version of the encryption algorithm, serialized as a single byte.
 * @internal
 */
export const VERSION = 1 satisfies Version;

/**
 * Byte length of the shortest valid ciphertext body: nonce and auth tag around empty plaintext
 * @internal
 */
export const MIN_LENGTH = xchacha20poly1305.nonceLength + xchacha20poly1305.tagLength;

// Keep a leading BOM, which would be part of the encrypted plaintext, not an encoding marker.
// Throw on invalid UTF-8 rather than silently continuing.
export const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
export const encoder = new TextEncoder();

/** @internal */
export const chacha = managedNonce(xchacha20poly1305);
