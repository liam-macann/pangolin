import { randomBytes } from '@noble/ciphers/utils.js';
import { afterAll, describe, expect, test, vi } from 'vitest';

import { type Encrypted, toBytes, toHex } from '@/lib/utils/encrypt';

import { getSession } from '@/auth';

import { header, version } from './constants';
import { crypto } from './index';
import * as keys from './internal/keys';

const TEST_USER_ID = 'user-123';

vi.spyOn(keys, 'retrieveDEK').mockResolvedValue(randomBytes(32));
vi.mocked(getSession).mockResolvedValue({ user: { id: TEST_USER_ID } } as never);

afterAll(() => vi.resetAllMocks());

describe('Encryption round-trip', () => {
	test.for([
		'Hello, World!',
		'日本語テスト 🔐',
		'',
	])('Encrypts a string and decrypts it back to the original: "%s"', async plaintext => {
		const vault = await crypto(TEST_USER_ID);
		const ciphertext = await vault.encrypt(plaintext);
		const result = await vault.decrypt(ciphertext);
		expect(result).toBe(plaintext);
		vault.destroy();
	});

	describe('Encryption generic variants', () => {
		test('Decrypts Encrypted<Uint8Array> values (byte form)', async () => {
			const vault = await crypto(TEST_USER_ID);
			const input = 'byte-form';

			const bytes = toBytes(await vault.encrypt(input));
			expect(await vault.decrypt(bytes)).toBe(input);

			vault.destroy();
		});

		test('Decrypts Encrypted<string> values (string form)', async () => {
			const vault = await crypto(TEST_USER_ID);
			const input = 'string-form';

			const hex = toHex(await vault.encrypt(input));
			expect(await vault.decrypt(hex)).toBe(input);

			vault.destroy();
		});
	});

	test.for([
		['alpha', 'beta', 'gamma'],
		['日本語テスト 🔐', 'beta', '🫀'],
		[],
	])('Encrypts and decrypts an array of strings: ["%s", …]', async inputs => {
		const vault = await crypto(TEST_USER_ID);
		const ciphertext = await vault.encrypt(inputs);
		const result = await vault.decrypt(ciphertext);
		expect(result).toEqual(inputs);
		vault.destroy();
	});
});

describe('encrypt()', () => {
	test('Produces different ciphertexts for the same plaintext (nonce randomness)', async () => {
		const vault = await crypto(TEST_USER_ID);
		const a = await vault.encrypt('same text');
		const b = await vault.encrypt('same text');
		expect(a).not.toEqual(b);
		vault.destroy();
	});

	test('Ciphertext starts with the magic header and version number', async () => {
		const vault = await crypto(TEST_USER_ID);
		const ciphertext = toBytes(await vault.encrypt(''));
		expect(ciphertext.slice(0, header.length)).toEqual(header); // magic header
		expect(ciphertext.slice(header.length, header.length + version.length)).toEqual(version); // version
		vault.destroy();
	});
});

describe('decrypt()', () => {
	test('Preserves holes in sparse arrays', async () => {
		const vault = await crypto(TEST_USER_ID);

		// biome-ignore lint/suspicious/noSparseArray: We are testing sparse array behavior
		const arr = [await vault.encrypt('test a'), , await vault.encrypt('test b')];

		// biome-ignore lint/suspicious/noExplicitAny: We are lying about types to test sparse array
		const result = await vault.decrypt(arr as any[]);

		// biome-ignore lint/suspicious/noSparseArray: We are testing sparse array behavior
		expect(result).toEqual(['test a', , 'test b']);
		expect(1 in result).toBe(false);

		vault.destroy();
	});
});

describe('decryptObject()', () => {
	test('Decrypts encrypted values within a flat object', async () => {
		const vault = await crypto(TEST_USER_ID);

		const obj = { name: await vault.encrypt('secret'), value: 42 };

		const result = await vault.decryptObject(obj);
		expect(result).toEqual({ name: 'secret', value: 42 });

		vault.destroy();
	});

	test('Decrypts nested encrypted values within an array', async () => {
		const vault = await crypto(TEST_USER_ID);

		const arr = [
			{ name: await vault.encrypt('secret'), value: 42 },
			'test',
			await vault.encrypt('🐙'),
		];

		const result = await vault.decryptObject(arr);
		expect(result).toEqual([{ name: 'secret', value: 42 }, 'test', '🐙']);

		vault.destroy();
	});

	test('Decrypts deeply nested encrypted values', async () => {
		const vault = await crypto(TEST_USER_ID);

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

		vault.destroy();
	});

	test('Decrypts Encrypted<Uint8Array> values within an object', async () => {
		const vault = await crypto(TEST_USER_ID);
		const obj = { name: toBytes(await vault.encrypt('byte-secret')) };
		expect(await vault.decryptObject(obj)).toMatchObject({ name: 'byte-secret' });
		vault.destroy();
	});

	test('Does not alter non-encrypted Uint8Array values', async () => {
		const vault = await crypto(TEST_USER_ID);
		const bytea = new Uint8Array([1, 2, 3]);
		const result = await vault.decryptObject({ raw: bytea });
		expect(result.raw).toEqual(bytea);
		vault.destroy();
	});

	test('Does not alter null and undefined values', async () => {
		const vault = await crypto(TEST_USER_ID);
		const result = await vault.decryptObject({ a: null, b: undefined });
		expect(result).toMatchObject({ a: null, b: undefined });
		vault.destroy();
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
		const vault = await crypto(TEST_USER_ID);

		const result = await vault.decryptObject({ opaque: val });
		expect(result.opaque).toBe(val);

		vault.destroy();
	});

	test('Decrypts values within a Map', async () => {
		const vault = await crypto(TEST_USER_ID);

		const map = new Map<unknown, unknown>([
			[await vault.encrypt('key'), await vault.encrypt('val')],
			['test', { secret: await vault.encrypt('deep-val') }],
		]);

		const result = await vault.decryptObject(map);
		expect(result.get('key')).toBe('val');
		expect(result.get('test')).toEqual({ secret: 'deep-val' });

		vault.destroy();
	});

	test('Decrypts values within a Set', async () => {
		const vault = await crypto(TEST_USER_ID);
		const set = new Set([await vault.encrypt('key'), { secret: await vault.encrypt('deep-set') }]);

		const result = await vault.decryptObject({ set: set });
		expect([...result.set.values()]).toEqual(['key', { secret: 'deep-set' }]);

		vault.destroy();
	});

	test('Handles objects with null prototype', async () => {
		const vault = await crypto(TEST_USER_ID);
		const obj = Object.create(null);
		obj.secret = await vault.encrypt('secret');

		const result = await vault.decryptObject(obj);
		expect(result.secret).toBe('secret');
		vault.destroy();
	});

	test('Preserves holes in sparse arrays', async () => {
		const vault = await crypto(TEST_USER_ID);

		// biome-ignore lint/suspicious/noSparseArray: We are testing sparse array behavior
		const arr = [await vault.encrypt('test a'), , await vault.encrypt('test b')];

		// biome-ignore lint/suspicious/noExplicitAny: We are lying about types to test sparse array
		const result = await vault.decryptObject(arr as any[]);

		// biome-ignore lint/suspicious/noSparseArray: We are testing sparse array behavior
		expect(result).toEqual(['test a', , 'test b']);
		expect(1 in result).toBe(false);

		vault.destroy();
	});
});

test('Throws after destroy() is called', async () => {
	const vault = await crypto(TEST_USER_ID);
	vault.destroy();

	await expect(vault.encrypt('anything')).rejects.toThrow('DEK has been destroyed');
	await expect(vault.decrypt(header as Encrypted)).rejects.toThrow('DEK has been destroyed');
});

test('Throws when session does not match requested UUID', async () => {
	const vault = await crypto('different-user');

	await expect(vault.encrypt('secret')).rejects.toThrow();
	vault.destroy();
});
