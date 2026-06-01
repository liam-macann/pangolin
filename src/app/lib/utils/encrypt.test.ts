import { bytesToHex } from '@noble/ciphers/utils.js';
import { describe, expect, expectTypeOf, test } from 'vitest';

import { header } from '@/lib/encrypt/constants';
import { type Encrypted, isEncrypted, toBytes, toHex } from '@/lib/utils/encrypt';

describe('isEncrypted', () => {
	test.for([
		[...header, 0x01, 0xde, 0xad, 0xbe, 0xef],
		[...header],
	])('Returns true for a Uint8Array starting with the magic header (test case %$)', bytea => {
		const encrypted = new Uint8Array(bytea);
		expect(isEncrypted(encrypted)).toBe(true);
	});

	test('Returns false for a Uint8Array without the magic header', () => {
		const plaintext = new Uint8Array([0x01, 0xde, 0xad, 0xbe, 0xef]);
		expect(isEncrypted(plaintext)).toBe(false);
	});

	test('Returns false with a partial header', () => {
		const partial = new Uint8Array([...header.slice(0, -1), 0x00, 0x01, 0x02, 0x03]); // 'CR' but not 'CRY'
		expect(isEncrypted(partial)).toBe(false);
	});

	test('Returns false for an empty Uint8Array', () => {
		expect(isEncrypted(new Uint8Array())).toBe(false);
	});

	test('Returns true for a hex string encoding bytes starting with the magic header', () => {
		const str = bytesToHex(new Uint8Array([...header, 0x01, 0xde, 0xad]));
		expect(isEncrypted(str)).toBe(true);
	});

	test('Returns false for a plain text string', () => {
		expect(isEncrypted('hello world')).toBe(false);
	});

	test('Returns false for an empty string', () => {
		expect(isEncrypted('')).toBe(false);
	});

	test('Returns false for a hex string without the magic header', () => {
		expect(isEncrypted(bytesToHex(new Uint8Array([0x01, 0xde, 0xad])))).toBe(false);

		// Check header in plaintext (not hex-encoded) form
		const decoder = new TextDecoder();
		expect(isEncrypted(decoder.decode(header))).toBe(false);
	});
});

describe('toHex', () => {
	test('Converts Uint8Array to hex string', () => {
		const bytes = new Uint8Array([0x43, 0x52, 0x59]);
		expect(toHex(bytes)).toBe('435259');
	});

	test('Returns string unchanged', () => expect(toHex('435259')).toBe('435259'));

	test('Preserves Encrypted brand on Encrypted input', () => {
		const enc = new Uint8Array([...header, 0x01]) as Encrypted<Uint8Array>;
		expectTypeOf(toHex(enc)).toEqualTypeOf<Encrypted<string>>();
	});
});

describe('toBytes', () => {
	test('Converts hex string to Uint8Array', () => {
		expect(toBytes('435259')).toEqual(new Uint8Array([0x43, 0x52, 0x59]));
	});

	test('Returns Uint8Array unchanged', () => {
		const bytes = new Uint8Array([1, 2, 3]);
		expect(toBytes(bytes)).toBe(bytes);
	});

	test('Preserves Encrypted brand on Encrypted input', () => {
		const enc = bytesToHex(new Uint8Array([...header, 0x01])) as Encrypted<string>;
		expectTypeOf(toBytes(enc)).toEqualTypeOf<Encrypted<Uint8Array>>();
	});

	test('toBytes is the inverse of toHex', () => {
		const bytes = new Uint8Array([0x43, 0x52, 0x59, 0x01]);
		expect(toBytes(toHex(bytes))).toEqual(bytes);
	});
});
