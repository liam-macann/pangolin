import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

import { header } from '@/lib/encrypt/constants';
import { type Brand } from '@/lib/utils';

const HEADER_HEX = bytesToHex(header);

export const isEncrypted = <T extends string | Uint8Array>(value: T): value is Encrypted<T> => {
	const hex = typeof value === 'string' ? value : bytesToHex(value.subarray(0, header.length));
	return hex.startsWith(HEADER_HEX);
};

/** Encrypted values may be stored as either Uint8Array, or as a hex-encoded string
 *
 * @remarks String format is required for transport
 */
export type Encrypted<T extends string | Uint8Array = string | Uint8Array> = Brand<T, 'Encrypted'>;

// Allows encoding and decoding regardless of encryption status. Preserves branded output if input is branded

export function toHex(value: Encrypted): Encrypted<string>;
export function toHex(value: string | Uint8Array): string;
export function toHex(value: Encrypted | string | Uint8Array) {
	return typeof value !== 'string' ? bytesToHex(value) : value;
}

export function toBytes(value: Encrypted): Encrypted<Uint8Array>;
export function toBytes(value: string | Uint8Array): Uint8Array;
export function toBytes(value: Encrypted | string | Uint8Array) {
	return typeof value === 'string' ? hexToBytes(value) : value;
}
