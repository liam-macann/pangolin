import { randomBytes } from '@noble/ciphers/utils.js';
import { describe, expect, test, vi } from 'vitest';

import { type Encrypted, toBytes, toHex } from '@/lib/utils/encrypt';

import { header, version } from './constants';
import { crypto } from './index';

const TEST_USER_ID = 'user-123';

vi.mock('./internal/keys', () => ({ retrieveDEK: vi.fn().mockResolvedValue(randomBytes(32)) }));

vi.mock('@/auth', () => ({
	getSession: vi.fn(async () => ({ user: { id: TEST_USER_ID } })),
}));

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

describe('decryptObject', () => {
	test('Decrypts encrypted values within a flat object', async () => {
		const vault = await crypto(TEST_USER_ID);

		const obj = { name: await vault.encrypt('secret'), value: 42 };

		const result = await vault.decryptObject(obj);
		expect(result).toMatchObject({ name: 'secret', value: 42 });

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

	test.for([
		['Date', new Date('2024-01-01T00:00:00Z')],
		['RegExp', /foo/gi],
		['Error', new Error('Test')],
		['URL', new URL('http://localhost:3000')],
		['ArrayBuffer', new ArrayBuffer(8)],
		['Int32Array', new Int32Array([1, 2, 3])],
		['Float64Array', new Float64Array([1.1, 2.2])],
		['DataView', new DataView(new ArrayBuffer(16), 0)],
		['function', () => {}],
		['Promise', Promise.resolve('settled')],
	])('Does not alter %s values', async ([_, val]) => {
		const vault = await crypto(TEST_USER_ID);

		const result = await vault.decryptObject({ opaque: val });
		expect(result.opaque).toBe(val);

		vault.destroy();
	});

	test('Decrypts values within a Map', async () => {
		const vault = await crypto(TEST_USER_ID);
		const map = new Map([[await vault.encrypt('key'), await vault.encrypt('val')]]);

		const result = await vault.decryptObject(map);
		expect(result.get('key')).toBe('val');

		vault.destroy();
	});

	test('Decrypts values within a Set', async () => {
		const vault = await crypto(TEST_USER_ID);
		const set = new Set([await vault.encrypt('key'), await vault.encrypt('val')]);

		const result = await vault.decryptObject({ set: set });
		expect([...result.set.values()]).toEqual(['key', 'val']);

		vault.destroy();
	});
});

test('Throws after destroy() is called', async () => {
	const vault = await crypto(TEST_USER_ID);
	vault.destroy();

	await expect(vault.encrypt('anything')).rejects.toThrow('DEK has been destroyed');
	await expect(vault.decrypt(header as Encrypted)).rejects.toThrow('DEK has been destroyed');
});

test('Throws when session does not match requested uuid', async () => {
	const vault = await crypto('different-user');

	await expect(vault.encrypt('secret')).rejects.toThrow();
	vault.destroy();
});
