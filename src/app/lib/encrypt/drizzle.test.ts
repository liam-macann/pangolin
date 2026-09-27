import { bytesToHex, concatBytes, randomBytes } from '@noble/ciphers/utils.js';
import { pgTable } from 'drizzle-orm/pg-core';
import { describe, expect, test } from 'vitest';

import { encrypted } from './drizzle';
import { MIN_LENGTH } from './internal/cipher';
import { Encrypted } from './internal/types';

const { column } = pgTable('test', { column: encrypted() });
const enc = new Encrypted(randomBytes(MIN_LENGTH));
const serialized = enc.serialize();

/** Serialized ciphertext as a view offset into a larger buffer */
const view = concatBytes(randomBytes(18), serialized, randomBytes(2)).subarray(
	18,
	serialized.length + 18,
);

describe('toDriver', () => {
	test('Converts Encrypted class to a serialized Buffer', () => {
		const value = column.mapToDriverValue(enc);

		expect(Buffer.isBuffer(value)).toBe(true);
		expect(new Uint8Array(value)).toEqual(serialized);
	});

	test('Throws on pre-serialized ciphertext', () => {
		expect(() => column.mapToDriverValue(serialized)).toThrow('Value is not encrypted');
		expect(() => column.mapToDriverValue(bytesToHex(serialized))).toThrow('Value is not encrypted');
	});

	test('Throws on plaintext', () => {
		expect(() => column.mapToDriverValue('plaintext')).toThrow('Value is not encrypted');
	});
});

describe('fromDriver', () => {
	test.for([
		['Uint8Array', new Uint8Array(serialized)],
		['Buffer', Buffer.from(serialized)],
		['Uint8Array view', view],
		['Buffer view', Buffer.concat([randomBytes(8), serialized]).subarray(8)],
		['bytea hex string', `\\x${bytesToHex(serialized)}`],
	])('Returns Encrypted from a %s', ([_, value]) => {
		const result = column.mapFromDriverValue(value);

		expect(result).toBeInstanceOf(Encrypted);
		expect(result).toEqual(enc);
	});

	test('Throws on a string without the bytea hex prefix', () => {
		expect(() => column.mapFromDriverValue(bytesToHex(serialized))).toThrow(
			'String is not hex encoded',
		);
	});

	test('Throws on bytes that are not framed', () => {
		expect(() => column.mapFromDriverValue(randomBytes(serialized.length))).toThrow(
			'Missing encryption header',
		);
	});
});
