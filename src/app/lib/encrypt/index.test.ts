import { randomBytes } from '@noble/ciphers/utils.js';
import { afterEach, aroundEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { type Vault, withVault } from '@/lib/encrypt';

import { getSession } from '@/auth';
import { sessionStorage } from '@/test/session';

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

	test('Checks the session once, not recursively per encrypted value', async () => {
		await withVault(async vault => {
			const obj = { a: await vault.encrypt('a'), b: [await vault.encrypt('b')] };
			vi.mocked(getSession).mockClear(); // Forget that withVault() and encrypt() already called it

			await vault.decryptDeep(obj);
			expect(getSession).toHaveBeenCalledOnce();
		});
	});
});
