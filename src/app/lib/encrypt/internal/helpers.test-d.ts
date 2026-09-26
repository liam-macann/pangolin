import { describe, expectTypeOf, test } from 'vitest';

import { isEncrypted, toBytes, toHex } from './helpers';
import { type Encrypted } from './types';

declare const bytes: Encrypted<Uint8Array>;
declare const hex: Encrypted<string>;

describe('toHex', () => {
	test('Preserves Encrypted brand on Encrypted input', () => {
		expectTypeOf(toHex(bytes)).toEqualTypeOf<Encrypted<string>>();
	});
});

describe('toBytes', () => {
	test('Preserves Encrypted brand on Encrypted input', () => {
		expectTypeOf(toBytes(hex)).toEqualTypeOf<Encrypted<Uint8Array>>();
	});
});

describe('isEncrypted', () => {
	test('Narrows to Encrypted', () => {
		expectTypeOf(isEncrypted).guards.toEqualTypeOf<Encrypted>();
	});
});
