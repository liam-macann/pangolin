import * as navigation from 'next/navigation';
import { afterEach, assert, describe, expect, expectTypeOf, vi } from 'vitest';

import { type Encrypted } from '@/lib/utils/encrypt';

import { createTestSession, getSession, sessionStorage, asUser as test } from '@/test/session';

import { type Vault, withVault } from './index';
import * as keys from './internal/keys';

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

/** Spies on DEK retrieval */
const spyOnDEK = () => {
	const spy = vi.spyOn(keys, 'retrieveDEK');

	return {
		spy,
		/** Resolves the unwrapped DEK returned by the n-th call */
		async nthDEK(i = 0) {
			const result = spy.mock.results[i];
			assert(result?.type === 'return', 'retrieveDEK() should have been called');
			return await result.value;
		},
	};
};

/** Whether a DEK has been wiped by `destroy()` */
const isZeroed = (DEK: Uint8Array) => DEK.every(byte => byte === 0);

describe('withVault()', () => {
	test('Encrypts and decrypts within the scope', async () => {
		const result = await withVault(async vault => vault.decrypt(await vault.encrypt('secret')));
		expect(result).toBe('secret');
	});

	test('Destroys the DEK after the callback resolves', async () => {
		const { nthDEK } = spyOnDEK();

		await withVault(async vault => {
			await vault.encrypt('anything');
			expect(isZeroed(await nthDEK(0))).toBe(false);
		});

		expect(isZeroed(await nthDEK(0))).toBe(true);
	});

	test('Destroys the DEK after the callback throws', async () => {
		const { nthDEK } = spyOnDEK();

		await expect(
			withVault(async () => {
				expect(isZeroed(await nthDEK(0))).toBe(false);
				throw new Error('callback failed');
			}),
		).rejects.toThrow('callback failed');

		expect(isZeroed(await nthDEK(0))).toBe(true);
	});

	test('Does not expose destroy() to the callback', async () => {
		expectTypeOf<Vault>().not.toHaveProperty('destroy');

		await withVault(async vault => {
			expect(vault).not.toHaveProperty('destroy');
		});
	});

	test('Throws when a vault is used after its scope exits', async () => {
		// @ts-expect-error Deliberately returning the vault to exercise the runtime guard
		const escaped = await withVault<Vault>(async vault => vault);
		await expect(escaped.encrypt('secret')).rejects.toThrow('DEK has been destroyed');

		// Type-level checks:

		// @ts-expect-error The vault must not be returned from its scope, even nested
		await withVault(async vault => ({ nested: [vault] }));

		// Positive control
		const allowed = await withVault(async vault => ({ id: 1, secret: await vault.encrypt('x') }));
		expectTypeOf(allowed).toEqualTypeOf<{ id: number; secret: Encrypted<string> }>();
	});

	test('Rejects unawaited operations that outlive their scope', async () => {
		// This test is important to ensure that crypto is never run with a zeroed DEK

		const ciphertext = await withVault(async vault => vault.encrypt('secret'));
		let inFlight: Promise<PromiseSettledResult<unknown>[]> | undefined;

		// Hold each session check open until the scope has exited
		const gate = Promise.withResolvers<void>();
		const getDelayedSession = async () => {
			await gate.promise;
			return sessionStorage.getStore() ?? null;
		};

		await withVault(async vault => {
			getSession
				.mockImplementationOnce(getDelayedSession)
				.mockImplementationOnce(getDelayedSession);

			inFlight = Promise.allSettled([vault.encrypt('secret'), vault.decrypt(ciphertext)]);
		});

		gate.resolve();

		assert(inFlight, 'Operations should have been started within the scope');
		const results = await inFlight;
		expect(results.map(result => result.status === 'rejected' && result.reason.message)).toEqual([
			'DEK has been destroyed',
			'DEK has been destroyed',
		]);
	});

	test('Does not enter the vault scope without an active session', async () => {
		const log = vi.fn(() => {});

		await expect(sessionStorage.exit(() => withVault(async () => log()))).rejects.toThrow();

		expect(log).not.toHaveBeenCalled();
		expect(navigation.unauthorized).toHaveBeenCalled();
	});

	test('Calls unauthorized() when the session ends mid-scope', async () => {
		await withVault(async vault => {
			await expect(sessionStorage.exit(() => vault.encrypt('secret'))).rejects.toThrow();

			await expect(
				sessionStorage.exit(() => vault.decrypt(new Uint8Array(32) as Encrypted)),
			).rejects.toThrow();

			await expect(
				sessionStorage.exit(() => vault.decryptObject({ secret: 'value' })),
			).rejects.toThrow();

			expect(navigation.unauthorized).toHaveBeenCalledTimes(3);
		});
	});

	test('Cannot decrypt ciphertext belonging to another user', async ({ db, auth }) => {
		const other = await createTestSession(db, auth);
		const ciphertext = await sessionStorage.run(other, () =>
			withVault(async vault => vault.encrypt('secret')),
		);

		await expect(withVault(async vault => vault.decrypt(ciphertext))).rejects.toThrow(
			'Failed to decrypt input',
		);

		// Positive control: the owner can decrypt it
		expect(
			await sessionStorage.run(other, () => withVault(async vault => vault.decrypt(ciphertext))),
		).toBe('secret');
	});

	test('Throws forbidden() and destroys DEK when the session changes mid-scope', async ({
		db,
		auth,
	}) => {
		const other = await createTestSession(db, auth);
		const { nthDEK } = spyOnDEK();

		await withVault(async vault => {
			await expect(sessionStorage.run(other, () => vault.encrypt('secret'))).rejects.toThrow();
			expect(navigation.forbidden).toHaveBeenCalled();

			// Checked inside the withVault scope, cleanup has not yet run
			expect(isZeroed(await nthDEK(0))).toBe(true);
		});
	});

	describe('Nesting', () => {
		test('Reuses the outer vault for the same user', async () => {
			const { spy } = spyOnDEK();

			await withVault(async outer => {
				await withVault(async inner => expect(inner).toBe(outer));

				// The inner scope must not destroy the DEK the outer scope still owns
				expect(await outer.decrypt(await outer.encrypt('secret'))).toBe('secret');
			});

			expect(spy).toHaveBeenCalledOnce();
		});

		test('Rejects a borrowed vault when the outer scope closes during session lookup', async () => {
			const { spy } = spyOnDEK();
			const gate = Promise.withResolvers<void>();
			let nested: Promise<unknown> | undefined;

			await withVault(async () => {
				getSession.mockImplementationOnce(async () => {
					await gate.promise;
					return sessionStorage.getStore() ?? null;
				});

				nested = withVault(async vault => vault.encrypt('secret')); // withVault() is not awaited
			});

			gate.resolve();

			assert(nested, 'Nested scope should have started within the outer scope');
			await expect(nested).rejects.toThrow('Vault scope has closed');
			expect(spy, 'Nested scope should not retrieve a fresh DEK').toHaveBeenCalledOnce();
		});

		test('Opens a fresh vault for nested callbacks invoked after the outer scope closes', async () => {
			const { spy } = spyOnDEK();
			const gate = Promise.withResolvers<void>();
			let deferred: Promise<string> | undefined;

			// Work invoked after the outer scope closes (eg. a Next.js after() callback) inherits a closed store.
			// The deferred work here also inherits the async context of the outer scope.
			await withVault(async () => {
				deferred = gate.promise.then(() =>
					withVault(async vault => vault.decrypt(await vault.encrypt('secret'))),
				);
			});

			expect(spy).toHaveBeenCalledOnce();

			gate.resolve();

			expect(await deferred).toBe('secret');
			expect(spy).toHaveBeenCalledTimes(2);
		});

		test('Throws forbidden() when nested scope is a different user', async ({ db, auth }) => {
			const other = await createTestSession(db, auth);
			const { spy } = spyOnDEK();

			await withVault(async outer => {
				await expect(
					sessionStorage.run(other, () => withVault(async vault => vault.encrypt('secret'))),
				).rejects.toThrow();

				expect(navigation.forbidden).toHaveBeenCalled();

				// Vault has not been destroyed, as the inner scope was never given a vault
				expect(await outer.decrypt(await outer.encrypt('secret'))).toBe('secret');
			});

			expect(spy, 'Inner scope should not have been issued a DEK').toHaveBeenCalledOnce();
		});
	});
});
