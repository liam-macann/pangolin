import { hexToBytes, randomBytes } from '@noble/ciphers/utils.js';

import { chacha, concatHeader, encoder } from './../../src/app/lib/encrypt/internal/helpers';
import { type Encrypted } from './../../src/app/lib/utils/encrypt';
import { type Transaction } from './../../src/db';
import * as schema from './../../src/db/schema';

function withKEK<T>(callback: (kek: Uint8Array) => T): T {
	const kek = hexToBytes(process.env.DB_ENCRYPTION_SECRET as string);
	const result = callback(kek);
	kek.fill(0);
	return result;
}

export type SeedCrypto = {
	encrypt(value: string): Encrypted;
};

export async function seedKeychain(tx: Transaction, userId: string): Promise<SeedCrypto> {
	const dek = randomBytes(32);
	const wrappedDek = withKEK(kek => concatHeader(chacha(kek).encrypt(dek)));

	await tx.insert(schema.keychain).values({ id: userId, key: wrappedDek }).onConflictDoNothing();

	return {
		encrypt: (value: string): Encrypted => concatHeader(chacha(dek).encrypt(encoder.encode(value))),
	};
}
