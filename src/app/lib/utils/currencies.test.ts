import { describe, expect } from 'vitest';

import { currencies as localCurrencies } from '@/lib/utils/currencies';
import * as tables from '@/db/schema';

import { asUser as test } from '@/test/session';

describe('currencies', () => {
	test('Local currency list matches active currencies in the reference table', async ({ db }) => {
		const dbCurrencies = await db
			.select({
				iso: tables.currencies.iso,
				name: tables.currencies.name,
				isActive: tables.currencies.isActive,
			})
			.from(tables.currencies);

		const activeDbCurrencies = dbCurrencies
			.filter(currency => currency.isActive)
			.map(({ iso, name }) => ({ iso, name }))
			.sort((a, b) => a.iso.localeCompare(b.iso));

		expect(localCurrencies, 'Run db:sync-currencies to generate a migration file').toEqual(
			activeDbCurrencies,
		);
	});
});
