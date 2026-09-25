import { randomBytes } from '@noble/ciphers/utils.js';
import * as navigation from 'next/navigation';
import { beforeEach, expect, vi } from 'vitest';

import { withRLS } from '@/db';
import { keychain } from '@/db/schema';

import { createTestSession, sessionStorage, asUser as test } from '@/test/session';

import { MIN_LENGTH } from './constants';
import { concatHeader, toHex } from './helpers';
import { retrieveDEK } from './keys';

// Mocks are shared with other files in this worker (isolate: false)
beforeEach(() => vi.clearAllMocks());

/** Stored keychain rows belonging to the active user */
const fetchStoredKeys = () => withRLS(db => db.select({ key: keychain.key }).from(keychain));

test('Generates and stores a DEK when none exists', async ({ session }) => {
	expect(await fetchStoredKeys()).toEqual([]);

	const DEK = await retrieveDEK(session.user.id);
	expect(DEK).toHaveLength(32);

	// DEK should be wrapped before being stored in the keychain
	expect(await fetchStoredKeys()).toEqual([{ key: expect.not.stringContaining(toHex(DEK)) }]);
});

test('Returns the stored DEK on later retrievals', async ({ session }) => {
	const DEK = toHex(await retrieveDEK(session.user.id));
	expect(toHex(await retrieveDEK(session.user.id))).toBe(DEK);
});

test('Calls forbidden() when requesting DEK belonging to another tenant', async ({ db, auth }) => {
	const other = await createTestSession(db, auth);

	await expect(retrieveDEK(other.user.id)).rejects.toThrow();
	expect(navigation.forbidden).toHaveBeenCalled();

	// No DEK was created for the other user; positive control that they can create their own
	await sessionStorage.run(other, async () => {
		expect(await fetchStoredKeys()).toEqual([]);
		expect(await retrieveDEK(other.user.id)).toHaveLength(32);
	});
});

test('Throws a generic error when the stored DEK cannot be unwrapped', async ({ session }) => {
	// Correctly framed, but not wrapped by the current KEK
	const key = concatHeader(randomBytes(MIN_LENGTH));
	await withRLS(db => db.insert(keychain).values({ id: session.user.id, key }));

	await expect(retrieveDEK(session.user.id)).rejects.toThrow('Failed to unwrap DEK');
});
