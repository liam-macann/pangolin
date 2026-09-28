import { bytesToHex, concatBytes } from '@noble/ciphers/utils.js';
import { assert, describe, expect, test } from 'vitest';

import { type Simplify } from '@/lib/utils';

import { HEADER, MIN_LENGTH, VERSION } from './cipher';
import { type Decrypted, Encrypted } from './types';
import { type DeepDecryptable, decryptDeep } from './walker';

/** Fixture, correlating generated ciphertext ref with plaintext equivalent */
const plaintexts = new WeakMap<Encrypted, string>();

function encrypt(plaintext: string) {
	const encrypted = new Encrypted(new Uint8Array(MIN_LENGTH));
	plaintexts.set(encrypted, plaintext);
	return encrypted;
}

function decrypt(encrypted: Encrypted) {
	const plaintext = plaintexts.get(encrypted);
	assert(plaintext !== undefined, 'Encrypted fixture should have a corresponding plaintext value');
	return plaintext;
}

/** Asserts output against an expected value (typed by {@link Decrypted}), ensuring the type and implementation agree. */
function expectDecrypted<T extends DeepDecryptable>(input: T, expected: NoInfer<Decrypted<T>>) {
	const result = decryptDeep(input, decrypt);
	expect(result).toStrictEqual(expected);
	return result;
}

describe('decryptDeep()', () => {
	test('Does not alter Encrypted-like representations', () => {
		const encrypted = encrypt('secret');

		const row = {
			hex: bytesToHex(encrypted.bytes),
			bytes: encrypted.bytes,
			class: encrypted,
			serialized: encrypted.serialize(),
			structural: {
				hex: 'hello',
				version: VERSION,
				bytes: new Uint8Array([1, 2, 3]),
				serialize: () => new Uint8Array([3, 2, 1]),
				toJSON: () => {
					throw new Error('This should not run');
				},
			} satisfies Simplify<Encrypted>,
		};

		expectDecrypted(row, { ...row, class: 'secret' });
	});

	test('Does not alter plaintext that starts with the framing hex', () => {
		const PREFIX_HEX = bytesToHex(concatBytes(HEADER, Uint8Array.of(VERSION)));
		const row = {
			id: `${PREFIX_HEX}-89ab-4cde-8f01-23456789abcd`,
			name: `${PREFIX_HEX} Holdings`,
			secret: encrypt('secret'),
		};

		expectDecrypted(row, { ...row, secret: 'secret' });
	});

	class Foo {
		value = 'secret';
	}

	test.for([
		['null', null],
		['undefined', undefined],
		['Date', new Date('2024-01-01T00:00:00Z')],
		['RegExp', /foo/gi],
		['Error', new Error('Test')],
		['URL', new URL('http://localhost:3000')],
		['Buffer', Buffer.from([8])],
		['ArrayBuffer', new ArrayBuffer(8)],
		['Uint8Array', new Uint8Array([1, 2, 3])],
		['Int32Array', new Int32Array([1, 2, 3])],
		['Float64Array', new Float64Array([1.1, 2.2])],
		['DataView', new DataView(new ArrayBuffer(16), 0)],
		['function', () => {}],
		['custom class', new Foo()],
		['Promise', Promise.resolve('settled')],
		['Symbol', Symbol('test')],
		['BigInt', BigInt('0x1fffffffffffff')],
		['Boxed Boolean', new Boolean(true)],
		['Boxed Number', new Number(10.3)],
		['Boxed String', new String('test')],
		['URLSearchParams', new URLSearchParams('test')],
		['Blob', new Blob(['test'], { type: 'text/plain' })],
		['WeakMap', new WeakMap([[{}, {}]])],
		['WeakSet', new WeakSet([{}, {}])],
		['WeakRef', new WeakRef({})],
		['Headers', new Headers({ key: 'value' })],
		['Generator', (function* () {})()],
	])('Does not alter %s values', ([_, val]) => {
		const { plain, array, set, map } = decryptDeep(
			{
				plain: val,
				array: [val],
				set: new Set([val]),
				map: new Map([[val, val]]),
			},
			decrypt,
		);

		expect.soft(plain).toBe(val);
		expect.soft(array[0]).toBe(val);
		expect.soft([...set][0]).toBe(val);
		expect.soft([...map.keys()][0]).toBe(val);
		expect.soft([...map.values()][0]).toBe(val);
	});

	test('Does not decrypt within class instances', () => {
		class Box {
			constructor(readonly secret: Encrypted) {}
		}

		const box = new Box(encrypt('secret'));
		const result = expectDecrypted({ box }, { box });

		expect(result.box).toBe(box);
		expect(result.box.secret).toBeInstanceOf(Encrypted);
	});

	test('Decrypts values within a Map', () => {
		const map = new Map<Encrypted | string, Encrypted | { secret: Encrypted }>([
			[encrypt('key'), encrypt('val')],
			['test', { secret: encrypt('deep-val') }],
		]);

		const expected = new Map<string, string | { secret: string }>([
			['key', 'val'],
			['test', { secret: 'deep-val' }],
		]);

		expectDecrypted(map, expected);
	});

	test('Decrypts values within a Set', () => {
		const set = new Set([encrypt('key'), { secret: encrypt('deep') }]);

		expectDecrypted(set, new Set(['key', { secret: 'deep' }]));
	});

	test('Decrypts every occurrence of a shared reference', () => {
		const shared = { secret: encrypt('secret') };
		const result = expectDecrypted(
			{ a: shared, b: [shared] },
			{ a: { secret: 'secret' }, b: [{ secret: 'secret' }] },
		);

		expect(result.b[0]).toBe(result.a); // Referential equality is preserved in the output
	});

	test('Decrypts circular references', () => {
		const obj: Record<string, unknown> = { secret: encrypt('secret') };
		obj.self = obj;

		const result = decryptDeep(obj, decrypt);

		expect(result.secret).toBe('secret');
		expect(result.self).toBe(result);
	});

	test('Preserves a null prototype object', () => {
		const obj = Object.create(null);
		obj.secret = encrypt('secret');

		const result = decryptDeep(obj, decrypt);
		expect(result.secret).toBe('secret');
		expect(Object.getPrototypeOf(result)).toBeNull();
	});

	test('Keeps a __proto__ key as an own property', () => {
		const encrypted = encrypt('secret');

		// Object.fromEntries() creates a __proto__ key, whereas an object literal would set the prototype
		const withEncrypted = Object.fromEntries([['__proto__', encrypted]]);
		const withObject = Object.fromEntries([['__proto__', { secret: encrypted }]]);

		expect(decryptDeep(withEncrypted, decrypt)).toHaveProperty('__proto__', 'secret');

		const withDecryptedObject = decryptDeep(withObject, decrypt);
		expect(withDecryptedObject).toHaveProperty('__proto__', { secret: 'secret' });
		expect(Object.getPrototypeOf(withDecryptedObject)).toBe(Object.prototype);
	});

	test('Decrypts symbol-keyed values, skipping non-enumerable keys', () => {
		const key = Symbol('key');
		const hidden = Symbol('hidden');
		const obj = { [key]: encrypt('secret') };
		Object.defineProperty(obj, hidden, { value: 'hidden', enumerable: false });

		const result = decryptDeep(obj, decrypt);
		expect(result[key]).toBe('secret');
		expect(Object.getOwnPropertySymbols(result)).toEqual([key]);
	});

	test('Preserves holes in sparse arrays', () => {
		// biome-ignore-start lint/suspicious/noSparseArray: We are testing sparse array behavior
		const arr = [encrypt('test a'), , encrypt('test b')];

		const result = decryptDeep(arr, decrypt);

		expect(result).toEqual(['test a', , 'test b']);
		expect(1 in result).toBe(false);
		// biome-ignore-end lint/suspicious/noSparseArray: We are testing sparse array behavior
	});
});
