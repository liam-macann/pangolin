import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes, managedNonce, randomBytes } from '@noble/ciphers/utils.js';

const encoder = new TextEncoder();

function encrypt(value: string, hexKey: string) {
	const key = hexToBytes(hexKey);
	const chacha = managedNonce(xchacha20poly1305)(key);

	const data = encoder.encode(value);
	const ciphertext = chacha.encrypt(data);

	return bytesToHex(ciphertext);
}

import { db } from '@/db';
import { keychain } from '@/db/schema';

export async function generateDEK(uuid: string) {
	const secretDEK = bytesToHex(randomBytes(32));

	const key = encrypt(secretDEK, process.env.DB_ENCRYPTION_SECRET as string);

	await db
		.insert(keychain)
		.values({
			id: uuid,
			key,
		})
		.onConflictDoNothing();
}
