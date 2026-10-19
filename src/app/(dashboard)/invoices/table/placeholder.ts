import { useMemo } from 'react';
import { Temporal } from 'temporal-polyfill';
import { match } from 'ts-pattern';

import type * as DTO from '@/api/dto/config';
import { invoiceReference, seededRandom } from '@/lib/utils';
import { NumericString } from '@/lib/utils/numeric';

import { type Invoice } from './columns';

const names = [
	'Alaric Wivell',
	'Hamish Heckathorn',
	'Fatimata Marseille',
	'Gagik Huntley',
	'Claritza Purdum',
	'Anniyah Budrow',
	'Japleen Hlad',
	'Tenoch Lorimer',
	'Abiel Mancusi',
	'Raylin Bennick',
	'Uzziel Poovey',
	'Priti Lobell',
	'Suzzanne Repetti',
	'Giordan Estenson',
	'Savir Wagman',
	'Aubriana Dilullo',
	'Saulo Amacker',
	'Irine Able',
	'Evely Turnmire',
];

// Entries repeated for randomness weighting
const status: Invoice['status'][] = [
	// The first two invoices will always be these values
	'unpaid',
	'paid',

	'unpaid',
	'paid',
	'paid',
	'refunded',
];

// biome-ignore format: Best to keep dense
const USD_EXCHANGE_RATES: Record<string, number> = {
	AED: 3.67,   AUD: 1.55,  BRL: 5.0,   CAD: 1.36,   CHF: 0.89,
	CNY: 7.25,   DKK: 7.0,   EUR: 0.92,  GBP: 0.79,   HKD: 7.8,
	IDR: 16000,  INR: 83,    JPY: 150,   KRW: 1350,   MXN: 17,
	MYR: 4.7,    NOK: 10.6,  NZD: 1.65,  PHP: 56,     PLN: 4.0,
	SAR: 3.75,   SEK: 10.4,  SGD: 1.34,  THB: 35,     TRY: 32,
	USD: 1,      ZAR: 18,    TWD: 32,    VND: 25000,  CZK: 23,
};

function realisticAmount(currency: string, seed: number): number {
	// Get a currency multiplier, so that JPY figures don't look like AUD
	const rate = USD_EXCHANGE_RATES[currency] ?? 1;

	const raw = (500 + seededRandom(seed) * 4500) * rate;
	const step = 10 ** (Math.floor(Math.log10(raw)) - 1);

	return Math.round(raw / step) * step;
}

type Config = Pick<DTO.Config, 'timezone' | 'currency' | 'numberingScheme'>;

/** Generate deterministic fake invoices */
export function usePlaceholderInvoices(config: Config, count = 5): Invoice[] {
	return useMemo(() => {
		const today = Temporal.Now.plainDateISO(config.timezone);

		const offsets = Array.from({ length: count }, (_, i) =>
			Math.round(7 + seededRandom(i * 3 + 1) * 21),
		).reduce<number[]>((acc, interval) => {
			acc.push((acc.at(-1) ?? 0) + interval);
			return acc;
		}, []);

		const issueDates = offsets.map(offset => today.subtract({ days: offset }));
		const yearIndexes = issueDates.map(
			({ year }, i) => issueDates.slice(i).filter(y => y.year === year).length,
		);

		return Array.from({ length: count }, (_, i) => {
			const nameIndex = Math.floor(seededRandom(i * 3 + 3) * names.length);

			const issuedAt = issueDates[i];
			const dueAt = issuedAt.add({ days: 14 });

			const partition = match(config.numberingScheme)
				.with('sequential', () => null)
				.with('annual', () => String(issuedAt.year))
				.exhaustive();

			const index = match(config.numberingScheme)
				.with('sequential', () => count - i)
				.with('annual', () => yearIndexes[i])
				.exhaustive();

			return {
				reference: invoiceReference({ index, partition }, config.numberingScheme),
				id: `placeholder-${i}`,
				createdAt: issuedAt
					.toZonedDateTime({ timeZone: config.timezone, plainTime: { hour: 12 } })
					.toInstant()
					.toString({ fractionalSecondDigits: 3 }),
				title: null,
				description: null,
				issuedAt: issuedAt.toString(),
				dueAt: dueAt.toString(),
				partition,
				index,
				netTotal: NumericString.parse(realisticAmount(config.currency, i * 3 + 2).toString()),
				grossTotal: NumericString.parse(realisticAmount(config.currency, i * 3 + 2).toString()),
				config: { timezone: config.timezone, currency: config.currency },
				client: {
					name: names[nameIndex],
					id: `placeholder-client-${nameIndex}`,
					organization: null,
				},
				notes: null,
				status:
					status[
						// Ensure that first two rows are predictable
						i < 2
							? i
							: // Use random status after that
								Math.floor(seededRandom(i * 3) * status.length)
					],
				isVoid: false,
			} satisfies Invoice;
		});
	}, [config, count]);
}

export default usePlaceholderInvoices;
