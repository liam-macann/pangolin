import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

/** Magic header to identify encrypted data in bytestream format.
 * @internal */
export const HEADER = new Uint8Array([0x43, 0x52, 0x59]); // CRY

/** Version of the encryption algorithm.
 * @internal */
export const VERSION = new Uint8Array([0x01]); // 1

/** Byte length of the shortest valid ciphertext: framing, nonce and auth tag around empty plaintext.
 * @internal */
export const MIN_LENGTH =
	HEADER.length + VERSION.length + xchacha20poly1305.nonceLength + xchacha20poly1305.tagLength;
