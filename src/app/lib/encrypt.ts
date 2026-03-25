import 'server-only';

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hexToBytes, managedNonce, randomBytes } from '@noble/ciphers/utils.js';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { keychain } from '@/db/schema';

import { getSession } from '@/auth';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const chacha = managedNonce(xchacha20poly1305);

/** Encrypts a string using the provided Data Encryption Key (DEK)
 * @internal
 */
function encrypt(value: string, DEK: Uint8Array): Uint8Array {
	const data = encoder.encode(value);
	const ciphertext = chacha(DEK).encrypt(data);

	return ciphertext;
}

/** Decrypts a Uint8Array using the provided Data Encryption Key (DEK)
 * @internal
 */
function decrypt(value: Uint8Array, DEK: Uint8Array): string {
	try {
		const bytestream = chacha(DEK).decrypt(value);
		const plaintext = decoder.decode(bytestream);

		return plaintext;
	} catch {
		// Avoid leaking errors
		throw new Error('Failed to decrypt input');
	}
}

/** Retrieves and unwraps the Data Encryption Key (DEK) for an authenticated user */
export async function crypto(uuid: string) {
	let destroyed = false;
	const DEK = await retrieveDEK(uuid);

	const auth = async <T>(fn: () => T) => {
		if (destroyed) throw new Error('DEK has been destroyed');
		const session = await getSession();

		// Explicit about which user DEK is requested
		if (session?.user.id !== uuid) {
			destroy();
			throw new Error('Unauthorized');
		}

		return fn();
	};

	const _encrypt = async (...args: string[]) => auth(() => args.map(arg => encrypt(arg, DEK)));
	const _decrypt = async (...args: Uint8Array[]) => auth(() => args.map(arg => decrypt(arg, DEK)));

	const destroy = () => {
		DEK.fill(0);
		destroyed = true;
	};

	return {
		/** Encrypts into array of ciphertext */
		encrypt: _encrypt,
		/** Decrypts ciphertext, returning an array of strings */
		decrypt: _decrypt,
		/** Clear the internal DEK from memory */
		destroy,
	};
}

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

const wrap = (DEK: Uint8Array): Uint8Array => withKEK(KEK => chacha(KEK).encrypt(DEK));
const unwrap = (DEK: Uint8Array): Uint8Array => withKEK(KEK => chacha(KEK).decrypt(DEK));

//
//
//
// DB operations
//

function generateWrappedDEK() {
	const SECRET_DEK = randomBytes(32);
	const key = wrap(SECRET_DEK);
	SECRET_DEK.fill(0);

	return key;
}

async function retrieveDEK(uuid: string) {
	const session = await getSession();

	// Explicit about which user DEK is requested
	if (session?.user.id !== uuid) throw new Error('Unauthorized');

	const insertDEK = async () => {
		const [res] = await db
			.insert(keychain)
			.values({ id: session.user.id, key: generateWrappedDEK() })
			.onConflictDoNothing()
			.returning({ key: keychain.key });

		// Refetch if key already exists (`onConflictDoNothing()` prevents return)
		// Addresses concurrency issue when multiple requests are made prior to keygen
		// (Avoids recursion to allow single retry and prevent infinite loop)
		return res.key || fetchDEK();
	};

	const fetchDEK = async () =>
		await db
			.select({ key: keychain.key })
			.from(keychain)
			.where(eq(keychain.id, session.user.id))
			.then(([res]) => res?.key);

	const key = (await fetchDEK()) ?? (await insertDEK());

	try {
		return unwrap(key);
	} catch {
		// Avoid leaking errors
		throw new Error('Failed to unwrap DEK');
	}
}
