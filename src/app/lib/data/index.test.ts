import { randomUUID } from 'node:crypto';
import * as navigation from 'next/navigation';
import { describe, expect } from 'vitest';

import {
	insertTestConfig,
	insertTestInvoice,
	setUpConfigAndClient,
} from '@/lib/actions/tests/helpers';

import { createTestSession, asUser as test } from '@/src/test/session';
import { sessionStorage } from '@/src/test/setup';

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
		db,
		auth,
	}) => {
		const otherSession = await createTestSession(db, auth);
		const configId = await insertTestConfig();

		await expect(sessionStorage.run(otherSession, () => fetchConfig(configId))).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();

		await expect(fetchConfig(configId)).resolves.not.toThrow();
	});

	test('Fetches the current active config by default', async () => {
		await insertTestConfig({ tradingName: 'Acme A' });
		await insertTestConfig({ tradingName: 'Acme B' });

		const config = await fetchConfig();
		expect(config.tradingName).toBe('Acme B');
	});

	test('Fetches a specific historical version by id', async () => {
		// Pin the first config so cleanup does not hard-delete it once invalidated
		const { configId: firstId, client } = await setUpConfigAndClient({ tradingName: 'Acme A' });
		await insertTestInvoice({
			clientDataId: client.data.scdId,
			items: [{ quantity: 1, unitCost: 100 }],
		});

		await insertTestConfig({ tradingName: 'Acme B' });

		const config = await fetchConfig(firstId);
		expect(config.tradingName).toBe('Acme A');
	});

	test('Decrypts scalar fields', async () => {
		await insertTestConfig({ email: 'billing@acme.example' });

		const config = await fetchConfig();
		expect(config.email).toBe('billing@acme.example');
	});

	test('Maps taxes from configTaxes, ordered by configured tax order', async () => {
		await insertTestConfig({
			taxRegistration: true,
			// Alphabetically, 'ATAX' would sort before 'ZTAX' — the opposite of configured order
			taxes: [
				{ name: 'ZTAX', rate: 10 },
				{ name: 'ATAX', rate: 5 },
			],
		});

		const config = await fetchConfig();
		expect(config.taxes.map(t => t.name)).toEqual(['ZTAX', 'ATAX']);
	});
});
