import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hexToBytes, managedNonce, randomBytes } from '@noble/ciphers/utils.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const chacha = managedNonce(xchacha20poly1305);

export function encrypt(value: string, DEK: Uint8Array): Uint8Array {
	const data = encoder.encode(value);
	const ciphertext = chacha(DEK).encrypt(data);

	return ciphertext;
}

export function decrypt(value: Uint8Array, DEK: Uint8Array): string {
	try {
		const bytestream = chacha(DEK).decrypt(value);
		const plaintext = decoder.decode(bytestream);

		return plaintext;
	} catch {
		// Avoid leaking errors
		throw new Error('Failed to decrypt input');
	}
}

const wrap = (DEK: Uint8Array, KEK: Uint8Array): Uint8Array => chacha(KEK).encrypt(DEK);
const unwrap = (DEK: Uint8Array, KEK: Uint8Array): Uint8Array => chacha(KEK).decrypt(DEK);

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { getSession } from '@/auth';
import { db } from '@/db';
import { keychain } from '@/db/schema';

async function generateDEK(uuid: string) {
	const SECRET_KEK = hexToBytes(process.env.DB_ENCRYPTION_SECRET as string);
	const key = wrap(randomBytes(32), SECRET_KEK);

	const [res] = await db
		.insert(keychain)
		.values({ id: uuid, key })
		.returning({ key: keychain.key });

	return res;
}

export async function retrieveDEK(uuid: string) {
	const session = await getSession({ headers: await headers() });

	// Explicit about which user DEK is requested
	if (session?.user.id !== uuid) throw new Error('Unauthorized');

	const { key } = await db
		.select({ key: keychain.key })
		.from(keychain)
		.where(eq(keychain.id, session.user.id))
		// Acceptable to make second DB call on init
		.then(async ([res]) => res ?? (await generateDEK(session.user.id)));

	try {
		const SECRET_KEK = hexToBytes(process.env.DB_ENCRYPTION_SECRET as string);
		return unwrap(key, SECRET_KEK);
	} catch {
		// Avoid leaking errors
		throw new Error('Failed to unwrap DEK');
	}
}
