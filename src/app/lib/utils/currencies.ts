import { currencies as data } from 'countries-list/currencies';

/** Financial index/accounting units listed as a secondary currency for their country
 *  (eg. Switzerland's CHE/CHW alongside CHF) */
// biome-ignore format: Best to keep dense
const excludedFundUnits = new Set([
	'BOV',	'CHE',	'CHW',	'CLF',	'USN',
	'UYI',	'COU',	'MXV',	'UYW',	'VED',
]);

/** ISO 4217 assigns these X-prefixed codes to currency unions rather than a single
 *  country. Unlike other X-codes (precious metals, IMF/composite units, test codes),
 *  these circulate for everyday use */
const supranationalCurrencies = new Set(['XAF', 'XCD', 'XCG', 'XOF', 'XPF']);

export const currencies = Object.entries(data)
	.filter(
		([iso, currency]) =>
			!currency.withdrawn &&
			(!iso.startsWith('X') || supranationalCurrencies.has(iso)) &&
			!excludedFundUnits.has(iso),
	)
	.map(([iso, currency]) => ({ iso, name: currency.name }))
	.sort((a, b) => a.iso.localeCompare(b.iso));

export const formatCurrency = (amount: number, currency: string, locale: string) =>
	new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);

// Using Intl (and not a simple symbol dictionary) allows locale to change display
// eg. an en-AU locale will not use the dollar sign for USD, which is ambiguous
export const getCurrencySymbol = (currency: string, locale: string): string | undefined =>
	new Intl.NumberFormat(locale, { style: 'currency', currency })
		.formatToParts(1)
		.find(x => x.type === 'currency')?.value;
