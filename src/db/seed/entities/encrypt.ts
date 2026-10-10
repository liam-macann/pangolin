import { hexToBytes, randomBytes } from '@noble/ciphers/utils.js';

// biome-ignore-start lint/plugin: Seeding wraps keys without a session, so needs the raw cipher primitives
import { chacha, encoder } from '@/lib/encrypt/internal/cipher';
import { Encrypted } from '@/lib/encrypt/internal/types';
// biome-ignore-end lint/plugin: Seeding wraps keys without a session, so needs the raw cipher primitives
import * as tables from '@/db/schema';
import { type Encrypt, type SeedDatabase } from '@/db/seed/shared/context';
import { assertSeedable } from '@/db/seed/shared/guard';

function withKEK<T>(callback: (kek: Uint8Array) => T): T {
	const secret = process.env.DB_ENCRYPTION_SECRET;
	if (!secret) throw new Error('DB_ENCRYPTION_SECRET is not set');

	const kek = hexToBytes(secret);
	try {
		return callback(kek);
	} finally {
		kek.fill(0);
	}
}

/** Stores a new data key for the user, and returns a function that encrypts with it.
 *  @throws When the user already has a key, as their existing data could not be read with a new one */
export async function seedKeychain(tx: SeedDatabase, userId: string): Promise<Encrypt> {
	await assertSeedable(tx);

	const dek = randomBytes(32);
	const wrappedDek = withKEK(kek => new Encrypted(chacha(kek).encrypt(dek)));

	const inserted = await tx
		.insert(tables.keychain)
		.values({ id: userId, key: wrappedDek })
		.onConflictDoNothing()
		.returning({ id: tables.keychain.id });

	// A key stands in for existing data: no config, client or invoice can be written without one.
	// Reads create a key too, so this also refuses a user who has only fetched data.
	if (inserted.length === 0)
		throw new Error(`User ${userId} already has an encryption key: reset before seeding`);

	return value => new Encrypted(chacha(dek).encrypt(encoder.encode(value)));
}
