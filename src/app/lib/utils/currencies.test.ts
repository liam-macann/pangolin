import { describe, expect } from 'vitest';
import { z } from 'zod';

import { currencies as localCurrencies } from '@/lib/utils/currencies';
import * as tables from '@/db/schema';

import { asUser as test } from '@/test/session';

describe('currencies', () => {
	test('Zod recognizes every selectable currency code', () => {
		// Zod matcher should be superset of the local currency list
		const unsupported = localCurrencies
			.map(currency => currency.iso)
			.filter(iso => !z.currencyCode().validate(iso));

		expect(unsupported, 'Update Zod to support the current currency list').toEqual([]);
	});

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
