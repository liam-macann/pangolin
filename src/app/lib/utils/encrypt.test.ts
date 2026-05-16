import { describe, expect, test } from 'vitest';

import { header } from '@/lib/encrypt/constants';
import { isEncrypted } from '@/lib/utils/encrypt';

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
});
