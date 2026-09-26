import { bytesToHex, concatBytes, randomBytes } from '@noble/ciphers/utils.js';
import { afterEach, aroundEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { type Vault, withVault } from '@/lib/encrypt';

import { getSession, sessionStorage } from '@/test/session';

import { HEADER, VERSION } from './internal/constants';
import * as keys from './internal/keys';
import { type Decrypted, Encrypted } from './internal/types';

aroundEach(
	async run => await sessionStorage.run({ user: { id: 'user-123' } } as never, () => run()),
);

beforeEach(() => vi.spyOn(keys, 'retrieveDEK').mockImplementation(async () => randomBytes(32)));
afterEach(() => vi.restoreAllMocks());

describe('Encryption round-trip', () => {
	test.for([
		['ASCII', 'Hello, World!'],
		['CJK and emoji', '日本語テスト 🔐'],
		['an empty string', ''],
		['NUL characters', 'a\0b\0'],
		['NFD text', 'Cafe\u0301'],
		['a ZWJ emoji sequence', '👩\u200D👩\u200D👧\u200D👦'],
	])('Encrypts and decrypts %s: "%s"', async ([_, plaintext]) => {
		await withVault(async vault => {
			const encrypted = await vault.encrypt(plaintext);
			const result = await vault.decrypt(encrypted);
			expect(result).toBe(plaintext);
		});
	});

	test('Preserves a leading byte order mark', async () => {
		await withVault(async vault => {
			const plaintext = '\uFEFFwith BOM';
			expect(await vault.decrypt(await vault.encrypt(plaintext))).toBe(plaintext);
		});
	});

	test('Replaces lone surrogates with �', async () => {
		await withVault(async vault => {
			// UTF-8 cannot encode an unpaired surrogate, so TextEncoder substitutes the replacement character
			const plaintext = 'a\uD800b\uDC00c';
			expect(await vault.decrypt(await vault.encrypt(plaintext))).toBe('a\uFFFDb\uFFFDc');
		});
	});

	test.for([['alpha', 'beta', 'gamma'], ['日本語テスト 🔐', 'beta', '🫀'], []])(
		'Encrypts and decrypts an array of strings: ["%s", …]',
		async inputs => {
			await withVault(async vault => {
				const encrypted = await vault.encrypt(inputs);
				const result = await vault.decrypt(encrypted);
				expect(result).toEqual(inputs);
			});
		},
	);
});

describe('encrypt()', () => {
	test('Produces different ciphertexts for the same plaintext (nonce randomness)', async () => {
		await withVault(async vault => {
			const a = await vault.encrypt('same text');
			const b = await vault.encrypt('same text');
			expect(a).not.toEqual(b);
		});
	});
});

describe('decrypt()', () => {
	test('Rejects ciphertext with an unsupported version', async () => {
		await withVault(async vault => {
			const enc = await vault.encrypt('secret');
			expect(await vault.decrypt(enc)).toBe('secret'); // Positive control

			const unsupported = new Encrypted(enc.bytes, 2);
			await expect(vault.decrypt(unsupported)).rejects.toThrow('Failed to decrypt input');
		});
	});

	test('Preserves holes in sparse arrays', async () => {
		// biome-ignore-start lint/suspicious/noSparseArray: We are testing sparse array behavior
		await withVault(async vault => {
			const arr = [await vault.encrypt('test a'), , await vault.encrypt('test b')];

			const result = await vault.decrypt(arr as Encrypted[]);

			expect(result).toEqual(['test a', , 'test b']);
			expect(1 in result).toBe(false);
		});
		// biome-ignore-end lint/suspicious/noSparseArray: We are testing sparse array behavior
	});
});

describe('decryptDeep()', () => {
	/** Asserts output against an expected value (typed by {@link Decrypted}), ensuring the type and implementation agree */
	async function expectDecrypted<T extends Parameters<Vault['decryptDeep']>[0]>(
		vault: Vault,
		input: T,
		expected: NoInfer<Decrypted<T>>,
	) {
		const result = await vault.decryptDeep(input);
		expect(result).toStrictEqual(expected);
		return result;
	}

	test('Decrypts values within nested objects and arrays', async () => {
		await withVault(async vault => {
			const nested = {
				name: await vault.encrypt('secret'),
				value: 42,
				children: [
					'test',
					{ name: await vault.encrypt('nested'), value: 7 },
					{ deep: { secret: await vault.encrypt('🐙') } },
				],
			};

			await expectDecrypted(vault, nested, {
				name: 'secret',
				value: 42,
				children: ['test', { name: 'nested', value: 7 }, { deep: { secret: '🐙' } }],
			});
		});
	});

	test('Does not alter ciphertext outside of Encrypted class', async () => {
		await withVault(async vault => {
			const encrypted = await vault.encrypt('secret');
			const row = { hex: bytesToHex(encrypted.bytes), bytes: encrypted.bytes, class: encrypted };

			await expectDecrypted(vault, row, { ...row, class: 'secret' });
		});
	});

	test('Does not alter plaintext that starts with the framing hex', async () => {
		const PREFIX_HEX = bytesToHex(concatBytes(HEADER, Uint8Array.of(VERSION)));

		await withVault(async vault => {
			const row = {
				id: `${PREFIX_HEX}-89ab-4cde-8f01-23456789abcd`,
				name: `${PREFIX_HEX} Holdings`,
				secret: await vault.encrypt('secret'),
			};

			await expectDecrypted(vault, row, { ...row, secret: 'secret' });
		});
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
	])('Does not alter %s values', async ([_, val]) => {
		await withVault(async vault => {
			const { plain, array, set, map } = await vault.decryptDeep({
				plain: val,
				array: [val],
				set: new Set([val]),
				map: new Map([[val, val]]),
			});

			expect.soft(plain).toBe(val);
			expect.soft(array[0]).toBe(val);
			expect.soft([...set][0]).toBe(val);
			expect.soft([...map.keys()][0]).toBe(val);
			expect.soft([...map.values()][0]).toBe(val);
		});
	});

	test('Does not decrypt within class instances', async () => {
		class Box {
			constructor(readonly secret: Encrypted) {}
		}

		await withVault(async vault => {
			const box = new Box(await vault.encrypt('secret'));

			const result = await expectDecrypted(vault, { box }, { box });
			expect(result.box).toBe(box);
			expect(result.box.secret).toBeInstanceOf(Encrypted);
		});
	});

	test('Decrypts values within a Map', async () => {
		await withVault(async vault => {
			const map = new Map<Encrypted | string, Encrypted | { secret: Encrypted }>([
				[await vault.encrypt('key'), await vault.encrypt('val')],
				['test', { secret: await vault.encrypt('deep-val') }],
			]);

			const expected = new Map<string, string | { secret: string }>([
				['key', 'val'],
				['test', { secret: 'deep-val' }],
			]);

			await expectDecrypted(vault, map, expected);
		});
	});

	test('Decrypts values within a Set', async () => {
		await withVault(async vault => {
			const set = new Set([await vault.encrypt('key'), { secret: await vault.encrypt('deep') }]);

			await expectDecrypted(vault, set, new Set(['key', { secret: 'deep' }]));
		});
	});
	test('Decrypts every occurrence of a shared reference', async () => {
		await withVault(async vault => {
			const shared = { secret: await vault.encrypt('secret') };

			const result = await expectDecrypted(
				vault,
				{ a: shared, b: [shared] },
				{ a: { secret: 'secret' }, b: [{ secret: 'secret' }] },
			);

			expect(result.b[0]).toBe(result.a); // Referential equality is preserved in the output
		});
	});

	test('Decrypts circular references', async () => {
		await withVault(async vault => {
			const obj: Record<string, unknown> = { secret: await vault.encrypt('secret') };
			obj.self = obj;

			const result = await vault.decryptDeep(obj);

			expect(result.secret).toBe('secret');
			expect(result.self).toBe(result);
		});
	});

	test('Preserves a null prototype object', async () => {
		await withVault(async vault => {
			const obj = Object.create(null);
			obj.secret = await vault.encrypt('secret');

			const result = await vault.decryptDeep(obj);
			expect(result.secret).toBe('secret');
			expect(Object.getPrototypeOf(result)).toBeNull();
		});
	});

	test('Keeps a __proto__ key as an own property', async () => {
		await withVault(async vault => {
			const encrypted = await vault.encrypt('secret');

			// Object.fromEntries() creates a __proto__ key, whereas an object literal would set the prototype
			const withEncrypted = Object.fromEntries([['__proto__', encrypted]]);
			const withObject = Object.fromEntries([['__proto__', { secret: encrypted }]]);

			expect(await vault.decryptDeep(withEncrypted)).toHaveProperty('__proto__', 'secret');

			const withDecryptedObject = await vault.decryptDeep(withObject);
			expect(withDecryptedObject).toHaveProperty('__proto__', { secret: 'secret' });
			expect(Object.getPrototypeOf(withDecryptedObject)).toBe(Object.prototype);
		});
	});

	test('Decrypts symbol-keyed values, skipping non-enumerable keys', async () => {
		await withVault(async vault => {
			const key = Symbol('key');
			const hidden = Symbol('hidden');
			const obj = { [key]: await vault.encrypt('secret') };
			Object.defineProperty(obj, hidden, { value: 'hidden', enumerable: false });

			const result = await vault.decryptDeep(obj);
			expect(result[key]).toBe('secret');
			expect(Object.getOwnPropertySymbols(result)).toEqual([key]);
		});
	});

	test('Preserves holes in sparse arrays', async () => {
		// biome-ignore-start lint/suspicious/noSparseArray: We are testing sparse array behavior
		await withVault(async vault => {
			const arr = [await vault.encrypt('test a'), , await vault.encrypt('test b')];

			const result = await vault.decryptDeep(arr as Encrypted[]);

			expect(result).toEqual(['test a', , 'test b']);
			expect(1 in result).toBe(false);
		});
		// biome-ignore-end lint/suspicious/noSparseArray: We are testing sparse array behavior
	});

	test('Checks the session once, not recursively per encrypted value', async () => {
		await withVault(async vault => {
			const obj = { a: await vault.encrypt('a'), b: [await vault.encrypt('b')] };
			getSession.mockClear(); // Forget that withVault() and encrypt() already called it

			await vault.decryptDeep(obj);
			expect(getSession).toHaveBeenCalledOnce();
		});
	});
});
