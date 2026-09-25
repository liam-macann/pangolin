import { type Brand } from '@/lib/utils';

/** Encrypted values may be stored as either Uint8Array, or as a hex-encoded string
 * @remarks String format is required for transport */
export type Encrypted<T extends string | Uint8Array = string | Uint8Array> = Brand<T, 'Encrypted'>;

type Passthrough =
	| Date
	| RegExp
	| Error
	| URL
	| ArrayBuffer
	| ArrayBufferView
	| ((...args: never) => unknown);

// biome-ignore format: Nested conditions easier to read when flat
/** Deeply replaces {@link Encrypted} values with their decrypted string representation.
 * @internal */
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
