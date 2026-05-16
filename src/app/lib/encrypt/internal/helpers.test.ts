import { describe, expect, expectTypeOf, test } from 'vitest';

import { isEncrypted } from '@/lib/utils/encrypt';

import { concatHeader, stripHeader } from './helpers';

describe('concatHeader', () => {
	test.for<Uint8Array>([
		new Uint8Array(32),
		new Uint8Array(0),
		new Uint8Array([1, 2, 3, 252]),
	])('Header is prepended', ciphertext => {
		// Check that header does not exist in input
		expect(isEncrypted(ciphertext)).toBe(false);

		const enc = concatHeader(ciphertext);

		// Check that header exists in output
		expect(enc).not.toEqual(ciphertext);
		expect(isEncrypted(enc)).toBe(true);

		// Check that the type is correctly branded
		expectTypeOf(ciphertext).not.toEqualTypeOf(enc);
	});

	test('Input is not mutated', () => {
		const ciphertext = new Uint8Array(32);
		const copy = structuredClone(ciphertext);

		expect(concatHeader(ciphertext)).not.toBe(ciphertext);

		// Checks that data is stable, not that reference is stable
		expect(ciphertext).toEqual(copy);
	});

	test('Function is idempotent', () => {
		const inp = new Uint8Array(32);
		expect(concatHeader(concatHeader(inp))).toEqual(concatHeader(inp));
	});
});

describe('stripHeader', () => {
	test.for<Uint8Array>([
		new Uint8Array(32),
		new Uint8Array(0),
		new Uint8Array([1, 2, 3, 252]),
	])('Header is removed', ciphertext => {
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
	});

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

	test('Function is idempotent', () => {
		const inp = concatHeader(new Uint8Array(32));
		expect(stripHeader(stripHeader(inp))).toEqual(stripHeader(inp));
	});
});
