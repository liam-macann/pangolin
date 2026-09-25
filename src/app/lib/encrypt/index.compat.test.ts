import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';
import { afterEach, assert, beforeEach, describe, expect, vi } from 'vitest';

import { withVault } from '@/lib/encrypt';
import { withRLS } from '@/db';
import { keychain } from '@/db/schema';

import { asUser as test } from '@/test/session';

import { isEncrypted } from './internal/helpers';
import * as keys from './internal/keys';

// Fixed ciphertext pinning the stored v1 format: a failure means existing data can no longer be read.
// Never regenerate them.

afterEach(() => vi.restoreAllMocks());

describe('Version 1', () => {
	const KEK = 'fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0efeeedecebeae9e8e7e6e5e4e3e2e1e0';

	beforeEach(() => {
		const before = process.env.DB_ENCRYPTION_SECRET;
		vi.stubEnv('DB_ENCRYPTION_SECRET', KEK);
		return () => void vi.stubEnv('DB_ENCRYPTION_SECRET', before);
	});

	test('Decrypts stored ciphertext', async () => {
		const DEK = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
		vi.spyOn(keys, 'retrieveDEK').mockImplementation(async () => hexToBytes(DEK));

		const ciphertext = [
			'43525901a2e8463154e3e67febbc06af33dcf368ec7b457ba114815e8',
			'1f3e845d867eebfd74a0062064793a1d0f683276e0a6cd85b6458b10c',
		].join('');

		assert(isEncrypted(ciphertext), 'Expected isEncrypted to recognize well-formed v1 ciphertext');
		await withVault(async vault => expect(await vault.decrypt(ciphertext)).toBe('Hello, World!'));
	});

	test('Unwraps stored DEK', async ({ session }) => {
		const DEK = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

		const wrapped = [
			'4352590180c3bda7c9c6533065f86a67facc99c2b135f49d97c48fc4c03788fdfd83934da542',
			'65674c71ef7043f8b4c4ce0f0a5a74681e6f0867ac8e28bc8fc5b3f0bf6d4414f5376c5ee0f0',
		].join('');

		assert(isEncrypted(wrapped), 'Expected isEncrypted to recognize well-formed v1 ciphertext');

		await withRLS(db => db.insert(keychain).values({ id: session.user.id, key: wrapped }));
		expect(bytesToHex(await keys.retrieveDEK(session.user.id))).toBe(DEK);
	});
});
