import 'server-only';

import { hexToBytes, randomBytes } from '@noble/ciphers/utils.js';
import { eq } from 'drizzle-orm';
import { forbidden } from 'next/navigation';
import { experimental_taintObjectReference } from 'react';

import { type Synchronous } from '@/lib/utils';
import { withRLS } from '@/db';
import { keychain } from '@/db/schema';

import { chacha, concatHeader, stripHeader } from './helpers';
import { type Encrypted } from './types';

//
//
//
// Key handling
//

/**
 * Use the Key Encryption Key (KEK) to perform operations on data.
 *
 * @internal
 *
 * @param callback - The function to execute with the KEK.
 * @returns The result of the callback function.
 */
function withKEK<T>(callback: (KEK: Uint8Array) => Synchronous<T>) {
	const SECRET_KEK = hexToBytes(process.env.DB_ENCRYPTION_SECRET as string);
	experimental_taintObjectReference('KEK must never be sent to the client.', SECRET_KEK);

	try {
		const val = callback(SECRET_KEK);
		return val;
	} finally {
		SECRET_KEK.fill(0);
	}
}

const wrap = (DEK: Uint8Array): Encrypted<Uint8Array> => {
	const res = withKEK(KEK => concatHeader(chacha(KEK).encrypt(DEK)));

	experimental_taintObjectReference('DEK must never be sent to the client.', res);
	return res;
};

const unwrap = (DEK: Encrypted): Uint8Array => {
	const res = withKEK(KEK => chacha(KEK).decrypt(stripHeader(DEK)));

	experimental_taintObjectReference('DEK must never be sent to the client.', res);
	return res;
};

//
//
//
// DB operations
//

/** Generates a new DEK and wraps it with the KEK
 * @internal */
function generateWrappedDEK() {
	const SECRET_DEK = randomBytes(32);

	try {
		return wrap(SECRET_DEK);
	} finally {
		SECRET_DEK.fill(0);
	}
}

/** Retrieves the current DEK for the authenticated user, or creates one if none exists
 * @internal */
export async function retrieveDEK(uuid: string) {
	const key = await withRLS(async (db, session) => {
		// Explicit about which user DEK is requested
		if (session?.user.id !== uuid) forbidden();

		const insertDEK = async () => {
			const [res] = await db
				.insert(keychain)
				.values({ id: session.user.id, key: generateWrappedDEK() })
				.onConflictDoNothing()
				.returning({ key: keychain.key });

			// Refetch if key already exists (`onConflictDoNothing()` prevents return)
			// Addresses concurrency issue when multiple requests are made prior to keygen
			// (Avoids recursion to allow single retry and prevent infinite loop)
			return res?.key || fetchDEK();
		};

		const fetchDEK = () =>
			db
				.select({ key: keychain.key })
				.from(keychain)
				.where(eq(keychain.id, session.user.id))
				.then(([res]) => res?.key);

		return (await fetchDEK()) ?? (await insertDEK());
	});

	try {
		return unwrap(key);
	} catch {
		// Avoid leaking errors
		throw new Error('Failed to unwrap DEK');
	}
}
