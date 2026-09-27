import { concatBytes, randomBytes } from '@noble/ciphers/utils.js';
import { describe, expect, test } from 'vitest';

import { HEADER, MIN_LENGTH, VERSION } from './cipher';
import { Encrypted } from './types';

/** Generate serialized ciphertext with a random body */
const genSerialized = ({ version = VERSION, bodyLength = MIN_LENGTH } = {}) =>
	concatBytes(HEADER, Uint8Array.of(version), randomBytes(bodyLength));

describe('Encrypted', () => {
	test('Accepts well-formed ciphertext', () => {
		const body = randomBytes(MIN_LENGTH);
		expect(new Encrypted(body).bytes).toEqual(body);
	});

	test('Constructs at the current version by default', () => {
		const body = randomBytes(MIN_LENGTH);
		expect(new Encrypted(body).version).toBe(VERSION);
	});

	test('Allows specifying a specific version', () => {
		const body = randomBytes(MIN_LENGTH);
		expect(new Encrypted(body, 0).version).toBe(0);
	});

	test('Throws on input shorter than the nonce and auth tag', () => {
		expect(() => new Encrypted(randomBytes(MIN_LENGTH - 1))).toThrow('Invalid ciphertext');
	});

	test.for([256, -1, 1.5, Number.NaN, 'a'])('Throws on version %s', version => {
		const body = randomBytes(MIN_LENGTH);
		// @ts-expect-error Bypasses the Version type
		expect(() => new Encrypted(body, version)).toThrow('Invalid version format');
	});

	test('Is not altered by mutating the input bytes', () => {
		const body = randomBytes(MIN_LENGTH);
		const enc = new Encrypted(body);

		const bytes = structuredClone(enc.bytes);
		const hex = enc.hex;

		body[HEADER.length] = 0x02;

		expect(enc.bytes).toEqual(bytes);
		expect(enc.hex).toBe(hex);
	});

	test('Is not altered by mutating the returned bytes', () => {
		const enc = new Encrypted(randomBytes(MIN_LENGTH));

		const bytes = structuredClone(enc.bytes);
		const hex = enc.hex;

		enc.bytes[HEADER.length] = 0x02;

		expect(enc.bytes).toEqual(bytes);
		expect(enc.hex).toBe(hex);
	});

	test('Holds only the viewed bytes when built from a view', () => {
		const body = randomBytes(MIN_LENGTH);
		const view = concatBytes(randomBytes(18), body, randomBytes(2)).subarray(18, body.length + 18);
		const enc = new Encrypted(view);

		expect(enc.bytes).toEqual(body);
		expect(enc.serialize()).toEqual(concatBytes(HEADER, Uint8Array.of(VERSION), body));
	});

	test('Throws on JSON serialization', () => {
		const enc = new Encrypted(randomBytes(MIN_LENGTH));
		expect(() => JSON.stringify(enc)).toThrow('Encrypted values cannot be serialized to JSON');
	});

	describe('serialize()', () => {
		test('Prepends the header and version byte to the body', () => {
			const body = randomBytes(MIN_LENGTH);
			expect(new Encrypted(body, 0).serialize()).toEqual(
				concatBytes(HEADER, Uint8Array.of(0), body),
			);
		});

		test('Preserves a body beginning with the framing bytes', () => {
			const body = genSerialized();
			expect(Encrypted.deserialize(new Encrypted(body).serialize()).bytes).toEqual(body);
		});
	});

	describe('deserialize()', () => {
		test('Is the inverse of serialize', () => {
			const serialized = genSerialized({ bodyLength: MIN_LENGTH + 100 });
			expect(Encrypted.deserialize(serialized).serialize()).toEqual(serialized);
		});

		test('Holds an unsupported version, rather than rejecting it', () => {
			expect(Encrypted.deserialize(genSerialized({ version: 255 })).version).toBe(255);
		});

		test.for<[string, Uint8Array]>([
			['a length below minimum', genSerialized({ bodyLength: MIN_LENGTH - 1 })],
			['only the magic header and version', genSerialized({ bodyLength: 0 })],
			['only the magic header', HEADER.slice()],
		])('Throws on bytes with %s', ([_, bytes]) =>
			expect(() => Encrypted.deserialize(bytes)).toThrow('Invalid ciphertext'),
		);

		test.for<[string, Uint8Array]>([
			['no magic header', new Uint8Array([0x01, 0xde, 0xad, 0xbe, 0xef])],
			['a partial header', new Uint8Array([...HEADER.slice(0, -1), 0x00, 0x01, 0x02, 0x03])], // 'CR' but not 'CRY'
			['no content', new Uint8Array()],
		])('Throws on bytes with %s', ([_, bytes]) =>
			expect(() => Encrypted.deserialize(bytes)).toThrow('Missing encryption header'),
		);
	});
});
