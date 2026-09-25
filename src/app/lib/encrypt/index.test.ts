import { randomBytes } from '@noble/ciphers/utils.js';
import { afterEach, aroundEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';

import { withVault } from '@/lib/encrypt';

import { sessionStorage } from '@/test/session';

import { header, version } from './internal/constants';
import { isEncrypted, toBytes, toHex } from './internal/helpers';
import * as keys from './internal/keys';

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
			const ciphertext = await vault.encrypt(plaintext);
			const result = await vault.decrypt(ciphertext);
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

	describe('Encryption generic variants', () => {
		test('Decrypts Encrypted<Uint8Array> values (byte form)', async () => {
			await withVault(async vault => {
				const bytes = toBytes(await vault.encrypt('byte-form'));
				expect(await vault.decrypt(bytes)).toBe('byte-form');
			});
		});

		test('Decrypts Encrypted<string> values (string form)', async () => {
			await withVault(async vault => {
				const hex = toHex(await vault.encrypt('string-form'));
				expect(await vault.decrypt(hex)).toBe('string-form');
			});
		});

		test('Decrypts uppercase hex', async () => {
			await withVault(async vault => {
				const upper = toHex(await vault.encrypt('upper-hex')).toUpperCase();
				assert(isEncrypted(upper), 'Uppercase hex should still carry the header');

				expect(await vault.decrypt(upper)).toBe('upper-hex');
			});
		});

		test('Decrypts bytes that are a view into a larger buffer', async () => {
			await withVault(async vault => {
				const bytes = toBytes(await vault.encrypt('pooled-secret'));
				const slice = Buffer.concat([Buffer.alloc(8), bytes]).subarray(8);
				assert(slice.byteOffset > 0, 'Slice should be offset into its underlying buffer');
				assert(isEncrypted(slice), 'Slice should carry the header');

				expect(await vault.decrypt(slice)).toBe('pooled-secret');
			});
		});

		test('Decrypts an array mixing hex and byte forms', async () => {
			await withVault(async vault => {
				const hex = toHex(await vault.encrypt('hex'));
				const bytes = toBytes(await vault.encrypt('bytes'));

				expect(await vault.decrypt([hex, bytes])).toEqual(['hex', 'bytes']);
			});
		});
	});

	test.for([['alpha', 'beta', 'gamma'], ['日本語テスト 🔐', 'beta', '🫀'], []])(
		'Encrypts and decrypts an array of strings: ["%s", …]',
		async inputs => {
			await withVault(async vault => {
				const ciphertext = await vault.encrypt(inputs);
				const result = await vault.decrypt(ciphertext);
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

	test('Ciphertext starts with the magic header and version number', async () => {
		await withVault(async vault => {
			const ciphertext = toBytes(await vault.encrypt(''));
			expect(ciphertext.slice(0, header.length)).toEqual(header); // magic header
			expect(ciphertext.slice(header.length, header.length + version.length)).toEqual(version); // version
		});
	});
});

describe('decrypt()', () => {
	test('Rejects ciphertext with an unknown version byte', async () => {
		await withVault(async vault => {
			const enc = toBytes(await vault.encrypt('secret')).slice();
			assert(isEncrypted(enc), 'Ciphertext should still carry the header');

			expect(await vault.decrypt(enc)).toBe('secret'); // Positive control

			enc[header.length] = 0x02; // Override version byte
			assert(isEncrypted(enc), 'Ciphertext should still carry the header');

			await expect(vault.decrypt(enc)).rejects.toThrow('Failed to decrypt input');
		});
	});

	test('Preserves holes in sparse arrays', async () => {
		await withVault(async vault => {
			// biome-ignore lint/suspicious/noSparseArray: We are testing sparse array behavior
			const arr = [await vault.encrypt('test a'), , await vault.encrypt('test b')];

			// biome-ignore lint/suspicious/noExplicitAny: We are lying about types to test sparse array
			const result = await vault.decrypt(arr as any[]);

			// biome-ignore lint/suspicious/noSparseArray: We are testing sparse array behavior
			expect(result).toEqual(['test a', , 'test b']);
			expect(1 in result).toBe(false);
		});
	});
});

describe('decryptObject()', () => {
	test('Decrypts encrypted values within a flat object', async () => {
		await withVault(async vault => {
			const obj = { name: await vault.encrypt('secret'), value: 42 };

			const result = await vault.decryptObject(obj);
			expect(result).toEqual({ name: 'secret', value: 42 });
		});
	});

	test('Decrypts nested encrypted values within an array', async () => {
		await withVault(async vault => {
			const arr = [
				{ name: await vault.encrypt('secret'), value: 42 },
				'test',
				await vault.encrypt('🐙'),
			];

			const result = await vault.decryptObject(arr);
			expect(result).toEqual([{ name: 'secret', value: 42 }, 'test', '🐙']);
		});
	});

	test('Decrypts deeply nested encrypted values', async () => {
		await withVault(async vault => {
			const nested = {
				top: {
					inner: {
						a: await vault.encrypt('deep-a'),
						b: { secret: await vault.encrypt('deep-b') },
						c: [await vault.encrypt('deep-c'), 'deep-d'],
					},
				},
			};

			expect(await vault.decryptObject(nested)).toMatchObject({
				top: {
					inner: {
						a: 'deep-a',
						b: { secret: 'deep-b' },
						c: ['deep-c', 'deep-d'],
					},
				},
			});
		});
	});

	test('Decrypts Encrypted<Uint8Array> values within an object', async () => {
		await withVault(async vault => {
			const obj = { name: toBytes(await vault.encrypt('byte-secret')) };
			expect(await vault.decryptObject(obj)).toMatchObject({ name: 'byte-secret' });
		});
	});

	test('Does not alter non-encrypted Uint8Array values', async () => {
		await withVault(async vault => {
			const bytea = new Uint8Array([1, 2, 3]);
			const result = await vault.decryptObject({ raw: bytea });
			expect(result.raw).toEqual(bytea);
		});
	});

	test('Does not alter null and undefined values', async () => {
		await withVault(async vault => {
			const result = await vault.decryptObject({ a: null, b: undefined });
			expect(result).toMatchObject({ a: null, b: undefined });
		});
	});

	class Foo {
		value = 'secret';
	}

	test.for([
		['Date', new Date('2024-01-01T00:00:00Z')],
		['RegExp', /foo/gi],
		['Error', new Error('Test')],
		['URL', new URL('http://localhost:3000')],
		['Buffer', Buffer.from([8])],
		['ArrayBuffer', new ArrayBuffer(8)],
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
	])('Does not alter %s values', async ([_, val]) => {
		await withVault(async vault => {
			const { plain, array, set, map } = await vault.decryptObject({
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

	test('Decrypts values within a Map', async () => {
		await withVault(async vault => {
			const map = new Map<unknown, unknown>([
				[await vault.encrypt('key'), await vault.encrypt('val')],
				['test', { secret: await vault.encrypt('deep-val') }],
			]);

			const result = await vault.decryptObject(map);
			expect(result.get('key')).toBe('val');
			expect(result.get('test')).toEqual({ secret: 'deep-val' });
		});
	});

	test('Decrypts values within a Set', async () => {
		await withVault(async vault => {
			const set = new Set([await vault.encrypt('key'), { secret: await vault.encrypt('deep') }]);

			const result = await vault.decryptObject({ set: set });
			expect([...result.set.values()]).toEqual(['key', { secret: 'deep' }]);
		});
	});

	test('Decrypts every occurrence of a shared reference', async () => {
		await withVault(async vault => {
			const shared = { secret: await vault.encrypt('secret') };

			const result = await vault.decryptObject({ a: shared, b: [shared] });

			expect(result).toEqual({ a: { secret: 'secret' }, b: [{ secret: 'secret' }] });
			expect(result.b[0]).toBe(result.a); // Referential equality is preserved in the output
		});
	});

	test('Decrypts circular references', async () => {
		await withVault(async vault => {
			const obj: Record<string, unknown> = { secret: await vault.encrypt('secret') };
			obj.self = obj;

			const result = await vault.decryptObject(obj);

			expect(result.secret).toBe('secret');
			expect(result.self).toBe(result);
		});
	});

	test('Preserves a null prototype object', async () => {
		await withVault(async vault => {
			const obj = Object.create(null);
			obj.secret = await vault.encrypt('secret');

			const result = await vault.decryptObject(obj);
			expect(result.secret).toBe('secret');
			expect(Object.getPrototypeOf(result)).toBeNull();
		});
	});

	test('Keeps a __proto__ key as an own property', async () => {
		await withVault(async vault => {
			const ciphertext = await vault.encrypt('secret');

			// Object.fromEntries() creates a __proto__ key, whereas an object literal would set the prototype
			const withString = Object.fromEntries([['__proto__', ciphertext]]);
			const withObject = Object.fromEntries([['__proto__', { secret: ciphertext }]]);

			expect(await vault.decryptObject(withString)).toHaveProperty('__proto__', 'secret');

			const withDecryptedObject = await vault.decryptObject(withObject);
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

			const result = await vault.decryptObject(obj);
			expect(result[key]).toBe('secret');
			expect(Object.getOwnPropertySymbols(result)).toEqual([key]);
		});
	});

	test('Preserves holes in sparse arrays', async () => {
		await withVault(async vault => {
			// biome-ignore lint/suspicious/noSparseArray: We are testing sparse array behavior
			const arr = [await vault.encrypt('test a'), , await vault.encrypt('test b')];

			// biome-ignore lint/suspicious/noExplicitAny: We are lying about types to test sparse array
			const result = await vault.decryptObject(arr as any[]);

			// biome-ignore lint/suspicious/noSparseArray: We are testing sparse array behavior
			expect(result).toEqual(['test a', , 'test b']);
			expect(1 in result).toBe(false);
		});
	});
});
