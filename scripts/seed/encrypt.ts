import { hexToBytes, randomBytes } from '@noble/ciphers/utils.js';

// biome-ignore-start lint/plugin: Seeding wraps keys without a session, so needs the raw cipher primitives
import { chacha, concatHeader, encoder } from '@/lib/encrypt/internal/helpers';
import { type Encrypted } from '@/lib/encrypt/internal/types';
// biome-ignore-end lint/plugin: Seeding wraps keys without a session, so needs the raw cipher primitives
import * as schema from '@/db/schema';

import { type Transaction } from '@/scripts/db';

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
