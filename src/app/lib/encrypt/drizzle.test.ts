import { concatBytes, randomBytes } from '@noble/ciphers/utils.js';
import { pgTable } from 'drizzle-orm/pg-core';
import { describe, expect, test } from 'vitest';

import { encrypted } from './drizzle';
import { MIN_LENGTH } from './internal/constants';
import { concatHeader, toHex } from './internal/helpers';
import { type Encrypted } from './internal/types';

const { column } = pgTable('test', { column: encrypted() });
const ciphertext = concatHeader(randomBytes(MIN_LENGTH));

/** Ciphertext as a view offset into a larger buffer */
const view = concatBytes(randomBytes(18), ciphertext, randomBytes(2)).subarray(
	18,
	ciphertext.length + 18,
) as Encrypted<Uint8Array>;

describe('toDriver', () => {
	test('Converts hex ciphertext to a Buffer', () => {
		const value = column.mapToDriverValue(toHex(ciphertext));

		expect(Buffer.isBuffer(value)).toBe(true);
		expect(new Uint8Array(value)).toEqual(ciphertext);
	});

	test('Converts a byte view to a new sliced Buffer', () => {
		expect(column.mapToDriverValue(view)).not.toEqual(ciphertext);
		expect(new Uint8Array(column.mapToDriverValue(view))).toEqual(ciphertext);
	});

	test('Throws on plaintext', () => {
		expect(() => column.mapToDriverValue('plaintext')).toThrow('Value is not encrypted');
	});
});

describe('fromDriver', () => {
	test.for([
		['Uint8Array', new Uint8Array(ciphertext)],
		['Buffer', Buffer.from(ciphertext)],
		['Uint8Array view', view],
		['Buffer view', Buffer.concat([randomBytes(8), ciphertext]).subarray(8)],
		['bytea hex string', `\\x${toHex(ciphertext)}`],
	])('Returns hex ciphertext from a %s', ([_, value]) => {
		expect(column.mapFromDriverValue(value)).toBe(toHex(ciphertext));
	});

	test('Throws on a string without the bytea hex prefix', () => {
		expect(() => column.mapFromDriverValue(toHex(ciphertext))).toThrow('String is not hex encoded');
	});

	test('Throws on bytes that are not ciphertext', () => {
		expect(() => column.mapFromDriverValue(randomBytes(MIN_LENGTH))).toThrow(
			'Value is invalid ciphertext',
		);
	});
});
