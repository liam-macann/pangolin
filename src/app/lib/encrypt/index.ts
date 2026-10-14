import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { forbidden, unauthorized } from 'next/navigation';

import { type Synchronous } from '@/lib/utils';

import { getSession } from '@/auth';

import { chacha, decoder, encoder, VERSION } from './internal/cipher';
import { retrieveDEK } from './internal/keys';
import { Encrypted } from './internal/types';
import { type DeepDecryptable, decryptDeep } from './internal/walker';

export type { Encrypted };

/** Encrypts a string using the provided Data Encryption Key (DEK)
 * @internal */
function encrypt(value: string, DEK: Uint8Array): Encrypted {
	const data = encoder.encode(value);
	return new Encrypted(chacha(DEK).encrypt(data));
}

/** Decrypts an Encrypted string using the provided Data Encryption Key (DEK)
 * @internal */
function decrypt(value: Encrypted, DEK: Uint8Array): string {
	try {
		if (value.version !== VERSION) throw new Error('Unsupported encryption version');

		const bytestream = chacha(DEK).decrypt(value.bytes);
		const plaintext = decoder.decode(bytestream);

		return plaintext;
	} catch {
		// Avoid leaking errors
		throw new Error('Failed to decrypt input');
	}
}

/** Retrieves and unwraps the Data Encryption Key (DEK) for an authenticated user */
async function crypto(uuid: string) {
	let destroyed = false;
	const DEK = await retrieveDEK(uuid);

	const destroy = () => {
		DEK.fill(0);
		destroyed = true;
	};

	const checkDestroyed = () => {
		if (destroyed) throw new Error('DEK has been destroyed');
	};

	const auth = async <T>(fn: () => Synchronous<T>) => {
		checkDestroyed();
		const session = (await getSession()) ?? unauthorized();

		// Explicit about which user DEK is requested
		if (session?.user.id !== uuid) {
			destroy();
			forbidden();
		}

		// The vault may have been destroyed while awaiting the session, which would run crypto with a zeroed DEK
		checkDestroyed();

		return fn();
	};

	function _encrypt(args: string): Promise<Encrypted>;
	function _encrypt(args: string[]): Promise<Encrypted[]>;
	async function _encrypt(args: string | string[]) {
		return auth(() =>
			Array.isArray(args) ? args.map(arg => encrypt(arg, DEK)) : encrypt(args, DEK),
		);
	}

	function _decrypt(args: Encrypted): Promise<string>;
	function _decrypt(args: Encrypted[]): Promise<string[]>;
	async function _decrypt(args: Encrypted | Encrypted[]) {
		return auth(() =>
			Array.isArray(args) ? args.map(arg => decrypt(arg, DEK)) : decrypt(args, DEK),
		);
	}

	const _decryptDeep = async <T extends DeepDecryptable>(input: T) =>
		// Authentication is handled once, before the walker decrypts values with the DEK directly
		auth(() => decryptDeep(input, value => decrypt(value, DEK)));

	return {
		/** Encrypts a string or array of strings into Encrypted values */
		encrypt: _encrypt,
		/** Decrypts Encrypted values, returning a string or array of strings */
		decrypt: _decrypt,
		/** Walks through an array, Set, Map, or plain object; decrypting any encrypted values */
		decryptDeep: _decryptDeep,
		/** Clear the internal DEK from memory */
		destroy,
	};
}

/** A crypto vault passed to a {@link withVault()} callback. */
export type Vault = Omit<Awaited<ReturnType<typeof crypto>>, 'destroy'>;

/** Allows any type except {@link Vault}. A fail-fast error that catches the basic case at compile time. */
type NoVault<T> = unknown extends T
	? T
	: T extends Vault
		? never
		: { [K in keyof T]: NoVault<T[K]> };

/** Allow nested {@link withVault()} calls to reuse the outer vault scope. */
const ctx = new AsyncLocalStorage<{ vault: Vault; userId: string; open: boolean }>();

/** Issues a crypto vault to the provided callback. Keys are destroyed once the outermost callback settles. */
export async function withVault<T>(
	callback: (vault: Vault) => Promise<T & NoVault<T>>,
): Promise<T> {
	const inherited = ctx.getStore();
	// Decide ownership before authentication yields, so a nested call is always inherited
	const borrowed = inherited?.open ? inherited : undefined;
	const session = (await getSession()) ?? unauthorized();

	if (borrowed) {
		// Only the outermost scope owns the DEK; a different user must never reuse it.
		// Refused before the vault is handed out, so the outer scope remains valid.
		if (borrowed.userId !== session.user.id) forbidden();
		if (!borrowed.open) throw new Error('Vault scope has closed');
		return callback(borrowed.vault);
	}

	// Work invoked after an outer scope closes inherits its context but owns a fresh vault.
	const { destroy, ...vault } = await crypto(session.user.id);
	const store = { vault, userId: session.user.id, open: true };

	try {
		return await ctx.run(store, () => callback(vault));
	} finally {
		store.open = false;
		destroy();
	}
}
