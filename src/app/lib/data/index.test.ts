import { randomUUID } from 'node:crypto';
import * as navigation from 'next/navigation';
import { assert, describe, expect } from 'vitest';

import { bypassRLS, createTestSession, sessionStorage, asUser as test } from '@/test/session';

import { fetchConfig } from './index';

describe('fetchConfig', () => {
	test('Throws notFound() when the user has no config at all', async () => {
		await expect(fetchConfig()).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();
	});

	test('Throws notFound() for a nonexistent config id', async () => {
		await expect(fetchConfig(randomUUID())).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();
	});

	test('Throws notFound() when fetching a config with incorrect ownership', async ({
		auth,
		seed,
	}) => {
		const otherSession = await createTestSession(auth);
		const [{ id: configId }] = await seed.config({ versions: 1 });

		// Checks that withRLS is not the only protection
		await expect(
			bypassRLS(() => sessionStorage.run(otherSession, () => fetchConfig(configId))),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		await expect(fetchConfig(configId)).resolves.not.toThrow();
	});

	test('Fetches the current active config by default', async ({ seed }) => {
		const active = (await seed.config({ versions: 4 })).at(-1);
		assert(active?.validTo === null, 'The last seeded config should be valid');

		const config = await fetchConfig();
		expect(config).toMatchObject({ id: active.id, tradingName: active.tradingName });
	});

	test('Fetches a specific historical version by id', async ({ seed }) => {
		const [first, active] = await seed.config({ versions: 2 });
		expect(first.validTo, 'Expected first config to be superseded').not.toBeNull();
		expect(active.validTo, 'Expected last config to be valid').toBeNull();

		const config = await fetchConfig(first.id);
		expect(config.id).not.toBe(active.id);
		expect(config.tradingName).toBe(first.tradingName);
	});

	test('Decrypts scalar fields', async ({ seed }) => {
		await seed.config({ overrides: [{ email: 'billing@acme.example' }] });

		const config = await fetchConfig();
		expect(config.email).toBe('billing@acme.example');
	});

	test('Maps taxes from configTaxes, ordered by configured tax order', async ({ seed }) => {
		// 'ATAX' sorts first both alphabetically and by insertion — the opposite of configured order
		const [atax, ztax] = await seed.taxes({ overrides: [{ name: 'ATAX' }, { name: 'ZTAX' }] });
		await seed.config({ overrides: [{ taxRegistration: true, taxes: [ztax.id, atax.id] }] });

		const config = await fetchConfig();
		expect(config.taxes.map(t => t.name)).toEqual(['ZTAX', 'ATAX']);
	});
});
