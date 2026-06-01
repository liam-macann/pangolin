import 'server-only';

import { hexToBytes, randomBytes } from '@noble/ciphers/utils.js';
import { eq } from 'drizzle-orm';
import { forbidden, unauthorized } from 'next/navigation';

import { type Encrypted } from '@/lib/utils/encrypt';
import { withRLS } from '@/db';
import { keychain } from '@/db/schema';

import { chacha, concatHeader, stripHeader } from './helpers';

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
function withKEK<T>(callback: (KEK: Uint8Array) => T) {
	const SECRET_KEK = hexToBytes(process.env.DB_ENCRYPTION_SECRET as string);

	const val = callback(SECRET_KEK);
	SECRET_KEK.fill(0);
	return val;
}

const wrap = (DEK: Uint8Array): Encrypted<Uint8Array> =>
	withKEK(KEK => concatHeader(chacha(KEK).encrypt(DEK)));

const unwrap = (DEK: Encrypted): Uint8Array =>
	withKEK(KEK => chacha(KEK).decrypt(stripHeader(DEK)));

//
//
//
// DB operations
//

/** Generates a new DEK and wraps it with the KEK
 *
 * @internal
 */
function generateWrappedDEK() {
	const SECRET_DEK = randomBytes(32);
	const key = wrap(SECRET_DEK);
	SECRET_DEK.fill(0);

	return key;
}

/** Retrieves the current DEK for the authenticated user, or creates one if none exists
 *
 * @internal
 */
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

		const fetchDEK = async () =>
			await db
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
