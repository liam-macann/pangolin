import { bytesToHex, concatBytes } from '@noble/ciphers/utils.js';
import { assert, describe, expect, expectTypeOf, test } from 'vitest';

import { header, version } from './constants';
import { concatHeader, decoder, isEncrypted, stripHeader, toBytes, toHex } from './helpers';
import { type Encrypted } from './types';

describe('decoder', () => {
	test('Throws on invalid UTF-8 rather than substituting U+FFFD', () => {
		expect(() => decoder.decode(new Uint8Array([0xff]))).toThrow();
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

describe('isEncrypted', () => {
	test.for([[...header, 0x01, 0xde, 0xad, 0xbe, 0xef], [...header]])(
		'Returns true for a Uint8Array starting with the magic header (test case %$)',
		bytea => {
			const encrypted = new Uint8Array(bytea);
			expect(isEncrypted(encrypted)).toBe(true);
		},
	);

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

describe('concatHeader', () => {
	test.for<Uint8Array>([new Uint8Array(32), new Uint8Array(0), new Uint8Array([1, 2, 3, 252])])(
		'Header is prepended',
		ciphertext => {
			// Check that header does not exist in input
			expect(isEncrypted(ciphertext)).toBe(false);

			const enc = concatHeader(ciphertext);

			// Check that header exists in output
			expect(enc).not.toEqual(ciphertext);
			expect(isEncrypted(enc)).toBe(true);

			// Check that the type is correctly branded
			expectTypeOf(ciphertext).not.toEqualTypeOf(enc);
		},
	);

	test('Input is not mutated', () => {
		const ciphertext = new Uint8Array(32);
		const copy = structuredClone(ciphertext);

		expect(concatHeader(ciphertext)).not.toBe(ciphertext);

		// Checks that data is stable, not that reference is stable
		expect(ciphertext).toEqual(copy);
	});

	test('Prepends both header and version bytes', () => {
		const ciphertext = new Uint8Array([1, 2, 3]);
		const enc = concatHeader(ciphertext);
		expect(enc.slice(0, header.length)).toEqual(header);
		expect(enc.slice(header.length, header.length + version.length)).toEqual(version);
		expect(enc.slice(header.length + version.length)).toEqual(ciphertext);
	});

	test('Preserves ciphertext beginning with the framing bytes', () => {
		const ciphertext = concatBytes(header, version, new Uint8Array([0xde, 0xad]));
		expect(stripHeader(concatHeader(ciphertext))).toEqual(ciphertext);
	});
});

describe('stripHeader', () => {
	test.for<Uint8Array>([new Uint8Array(32), new Uint8Array(0), new Uint8Array([1, 2, 3, 252])])(
		'Header is removed',
		ciphertext => {
			const enc = concatHeader(ciphertext);

			// Check that header exists in input
			expect(enc).not.toEqual(ciphertext);
			expect(isEncrypted(enc)).toBe(true);

			// Check that the type is correctly branded
			expectTypeOf(ciphertext).not.toEqualTypeOf(enc);

			const res = stripHeader(enc);

			// Check that header does not exist in output
			expect(isEncrypted(res)).toBe(false);
			expect(res).not.toEqual(enc);

			// Check that type has been unbranded
			expectTypeOf(res).toEqualTypeOf(ciphertext);

			// Check that we have returned to input ciphertext
			expect(res).toEqual(ciphertext);
		},
	);

	test('stripHeader is the inverse of concatHeader', () => {
		const ciphertext = new Uint8Array([1, 2, 3, 4]);
		expect(stripHeader(concatHeader(ciphertext))).toEqual(ciphertext);
	});

	test('Input is not mutated', () => {
		const enc = concatHeader(new Uint8Array(32));
		const copy = structuredClone(enc);

		expect(stripHeader(enc)).not.toBe(enc);

		// Checks that data is stable, not that reference is stable
		expect(enc).toEqual(copy);
	});

	test('Accepts Encrypted<string> (hex form) and strips correctly', () => {
		const ciphertext = new Uint8Array([1, 2, 3]);
		const encBytes = concatHeader(ciphertext);
		const encHex = toHex(encBytes);

		expect(stripHeader(encHex)).toEqual(ciphertext);
	});

	test.for([0x00, 0x02, 0xff])('Throws on unknown version byte: %i', unknownVersion => {
		const enc = concatBytes(header, new Uint8Array([unknownVersion]), new Uint8Array([1, 2, 3]));
		assert(isEncrypted(enc), 'Input should carry the header');

		expect(() => stripHeader(enc)).toThrow('Unsupported encryption version');
		expect(() => stripHeader(toHex(enc))).toThrow('Unsupported encryption version');
	});

	test.for([new Uint8Array([0x01, 0x02, 0x03]), 'cry', 'CRY'])(
		'Throws when header is missing',
		noHeader => {
			// biome-ignore lint/suspicious/noExplicitAny: intentional bad input in test
			expect(() => stripHeader(noHeader as any)).toThrow('Missing encryption header');
		},
	);
});
