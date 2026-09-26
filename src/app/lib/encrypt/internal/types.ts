import { bytesToHex, concatBytes, equalBytes, hexToBytes } from '@noble/ciphers/utils.js';
import { type Simplify, type UnknownRecord } from 'type-fest';

import { HEADER, MIN_LENGTH, VERSION, type Version } from './cipher';

const PREFIX_LENGTH = HEADER.length + Uint8Array.of(VERSION).length;

const isVersionByte = (value: number): value is Version =>
	Number.isInteger(value) && value >= 0 && value <= 0xff;

/** Holds well-formed ciphertext
 * @remarks Provides serialization methods for storage */
export class Encrypted {
	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: Brand makes the type nominal, so structurally identical objects aren't processed
	readonly #brand = true;

	// String is an immutable representation, and remains enumerable to facilitate equality comparison
	/** Ciphertext body (nonce, ciphertext, auth tag) in hex format */
	readonly hex: string;
	readonly version: Version;

	constructor(body: Uint8Array, version: Version = VERSION) {
		if (body.length < MIN_LENGTH) throw new Error('Invalid ciphertext');

		// Version is checked at runtime, as serialize() would otherwise truncate it to a byte
		if (!isVersionByte(version)) throw new Error('Invalid version format');

		this.hex = bytesToHex(body);
		this.version = version;
		Object.freeze(this);
	}

	/** Ciphertext body (nonce, ciphertext, auth tag) in byte format */
	get bytes(): Uint8Array {
		return hexToBytes(this.hex);
	}

	/** Frames the body with magic header and version byte, for storage */
	serialize(): Uint8Array {
		return concatBytes(HEADER, Uint8Array.of(this.version), this.bytes);
	}

	toJSON(): never {
		throw new Error('Encrypted values cannot be serialized to JSON');
	}

	/** Parses serialized ciphertext */
	static deserialize(bytes: Uint8Array): Encrypted {
		const hasHeader = equalBytes(bytes.subarray(0, HEADER.length), HEADER);
		if (!hasHeader) throw new Error('Missing encryption header');

		if (bytes.length < PREFIX_LENGTH + MIN_LENGTH) throw new Error('Invalid ciphertext');

		// A single version byte follows the header
		const version = bytes[HEADER.length];
		if (!isVersionByte(version)) throw new Error('Invalid version format');

		return new Encrypted(bytes.subarray(HEADER.length + 1), version);
	}
}

type Passthrough =
	| Date
	| RegExp
	| Error
	| URL
	| URLSearchParams
	| Headers
	| Blob
	| ((...args: never) => unknown);

// biome-ignore format: Nested conditions easier to read when flat
type Decrypt<T, Data = string> =
  T extends Encrypted ? Data :
  T extends UnknownRecord ? { [K in keyof T]: Decrypt<T[K], Data> } :
	T extends Passthrough ? T : // Before collections, as URLSearchParams structurally satisfies ReadonlyMap
	T extends ReadonlyArray<unknown> ? { [K in keyof T]: Decrypt<T[K], Data> } :
	T extends Set<infer U> ? Set<Decrypt<U, Data>> :
	T extends ReadonlySet<infer U> ? ReadonlySet<Decrypt<U, Data>> :
	T extends Map<infer K, infer U> ? Map<Decrypt<K, Data>, Decrypt<U, Data>> :
	T extends ReadonlyMap<infer K, infer U> ? ReadonlyMap<Decrypt<K, Data>, Decrypt<U, Data>> :
	T extends { readonly [Symbol.toStringTag]: string } ? T : // Mirrors isPlainObject() which checks tag
	T extends object ? Simplify<T> extends T ? { [K in keyof T]: Decrypt<T[K], string | Encrypted> } : T :
	T;

/** Deeply replaces {@link Encrypted} values with their decrypted string representation. */
export type Decrypted<T> = Decrypt<T, string>;
