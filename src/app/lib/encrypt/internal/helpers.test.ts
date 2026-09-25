import { bytesToHex, concatBytes, randomBytes } from '@noble/ciphers/utils.js';
import { describe, expect, expectTypeOf, test } from 'vitest';

import { HEADER, MIN_LENGTH, VERSION } from './constants';
import { chacha, concatHeader, decoder, isEncrypted, stripHeader, toBytes, toHex } from './helpers';
import { type Encrypted } from './types';

/** Shortest body that concatHeader() frames into valid ciphertext */
const MIN_BODY_LENGTH = MIN_LENGTH - HEADER.length - VERSION.length;

test('Ciphertext of an empty string is exactly MIN_LENGTH bytes', () => {
	const ciphertext = concatHeader(chacha(randomBytes(32)).encrypt(new Uint8Array()));
	expect(ciphertext).toHaveLength(MIN_LENGTH);
});

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
		const enc = new Uint8Array([...HEADER, 0x01]) as Encrypted<Uint8Array>;
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
		const enc = bytesToHex(new Uint8Array([...HEADER, 0x01])) as Encrypted<string>;
		expectTypeOf(toBytes(enc)).toEqualTypeOf<Encrypted<Uint8Array>>();
	});

	test('toBytes is the inverse of toHex', () => {
		const bytes = new Uint8Array([0x43, 0x52, 0x59, 0x01]);
		expect(toBytes(toHex(bytes))).toEqual(bytes);
	});
});

describe('isEncrypted', () => {
	expectTypeOf(isEncrypted).guards.toEqualTypeOf<Encrypted>();

	/** Generate ciphertext with a random body */
	const genCiphertext = ({ version = VERSION, length: len = MIN_LENGTH } = {}) =>
		concatBytes(HEADER, version, randomBytes(len - HEADER.length - version.length));

	test('Returns true for well-formed ciphertext, in hex or byte form', () => {
		const ciphertext = genCiphertext();
		expect(isEncrypted(toBytes(ciphertext))).toBe(true);
		expect(isEncrypted(toHex(ciphertext).toLowerCase())).toBe(true);
		expect(isEncrypted(toHex(ciphertext).toUpperCase())).toBe(true);
	});

	test.for([
		['a length below minimum', genCiphertext({ length: MIN_LENGTH - 1 })],
		['an unknown version', genCiphertext({ version: new Uint8Array([0x02]) })],
		['odd-length hex', `${toHex(genCiphertext())}0`],
		['trailing whitespace', `${toHex(genCiphertext())}  `],
	])('Rejects ciphertext with %s', ([_, value]) => {
		expect(isEncrypted(value)).toBe(false);
	});

	test.for([
		bytesToHex(HEADER),
		`${bytesToHex(HEADER)}Holdings`,
		`${bytesToHex(concatBytes(HEADER, VERSION))}-89ab-4cde-8f01-23456789abcd`,
	])('Rejects plaintext starting with the header: "%s"', value => {
		expect(isEncrypted(value)).toBe(false);
	});

	test('Returns false for a Uint8Array without the magic header', () => {
		const plaintext = new Uint8Array([0x01, 0xde, 0xad, 0xbe, 0xef]);
		expect(isEncrypted(plaintext)).toBe(false);
	});

	test('Returns false with a partial header', () => {
		const partial = new Uint8Array([...HEADER.slice(0, -1), 0x00, 0x01, 0x02, 0x03]); // 'CR' but not 'CRY'
		expect(isEncrypted(partial)).toBe(false);
	});

	test('Returns false for an empty Uint8Array', () => {
		expect(isEncrypted(new Uint8Array())).toBe(false);
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
		expect(isEncrypted(decoder.decode(HEADER))).toBe(false);
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
			expect(enc.slice(0, HEADER.length)).toEqual(HEADER);

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
		expect(enc.slice(0, HEADER.length)).toEqual(HEADER);
		expect(enc.slice(HEADER.length, HEADER.length + VERSION.length)).toEqual(VERSION);
		expect(enc.slice(HEADER.length + VERSION.length)).toEqual(ciphertext);
	});

	test('Preserves ciphertext beginning with the framing bytes', () => {
		const ciphertext = concatBytes(HEADER, VERSION, randomBytes(MIN_BODY_LENGTH));
		expect(stripHeader(concatHeader(ciphertext))).toEqual(ciphertext);
	});
});

describe('stripHeader', () => {
	test('Accepts Encrypted<string> (hex form) and strips correctly', () => {
		const ciphertext = randomBytes(MIN_BODY_LENGTH);
		const encBytes = concatHeader(ciphertext);
		const encHex = toHex(encBytes);

		expect(stripHeader(encHex)).toEqual(ciphertext);
	});

	test('Accepts Encrypted<Uint8Array> (byte form) and strips correctly', () => {
		const ciphertext = randomBytes(MIN_BODY_LENGTH);
		const encBytes = concatHeader(ciphertext);

		expect(stripHeader(encBytes)).toEqual(ciphertext);
	});

	test('stripHeader is the inverse of concatHeader', () => {
		const ciphertext = randomBytes(MIN_BODY_LENGTH);
		const res = stripHeader(concatHeader(ciphertext));

		expect(res).toEqual(ciphertext);
		expectTypeOf(res).toEqualTypeOf<Uint8Array>(); // Unbranded
	});

	test('Input is not mutated', () => {
		const enc = concatHeader(new Uint8Array(MIN_BODY_LENGTH));
		const copy = structuredClone(enc);

		expect(stripHeader(enc)).not.toBe(enc);

		// Checks that data is stable, not that reference is stable
		expect(enc).toEqual(copy);
	});

	test.for([0x00, 0x02, 0xff])('Throws on unknown version byte: %i', unknownVersion => {
		const enc = concatBytes(
			HEADER,
			new Uint8Array([unknownVersion]),
			new Uint8Array(MIN_BODY_LENGTH),
		) as Encrypted<Uint8Array>;

		expect(() => stripHeader(enc)).toThrow('Invalid ciphertext');
		expect(() => stripHeader(toHex(enc))).toThrow('Invalid ciphertext');
	});

	test.for([new Uint8Array([0x01, 0x02, 0x03]), 'cry', 'CRY'])(
		'Throws when header is missing',
		noHeader => {
			// biome-ignore lint/suspicious/noExplicitAny: intentional bad input in test
			expect(() => stripHeader(noHeader as any)).toThrow('Invalid ciphertext');
		},
	);
});
