import { Temporal } from 'temporal-polyfill';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { formatDate, toTemporal } from '@/lib/utils/date';

describe('toTemporal', () => {
	describe('decode', () => {
		test('Converts a Date to the same Temporal.Instant', () => {
			const result = toTemporal.decode(new Date('2026-01-15T00:30:00Z'));

			expect(result).toBeInstanceOf(Temporal.Instant);
			expect(result.toString()).toBe('2026-01-15T00:30:00Z');
		});
	});

	describe('encode', () => {
		test('Converts a Temporal.Instant to the same instant as a Date', () => {
			const temporal = Temporal.Instant.from('2026-01-15T00:30:00Z');
			expect(toTemporal.encode(temporal)).toEqual(new Date('2026-01-15T00:30:00Z'));
		});
	});

	test('Round-trips without losing millisecond precision', () => {
		const date = new Date('1969-12-31T23:59:59.123Z');
		expect(toTemporal.encode(toTemporal.decode(date))).toEqual(date);
	});
});

describe('formatDate', () => {
	describe('Accepts compatible date-like inputs', () => {
		test.for([
			['ISO string', '2025-02-15'],
			['PlainDate', Temporal.PlainDate.from('2025-02-15')],
			['PlainDateTime', Temporal.PlainDateTime.from('2025-02-15T00:00:00')],
			['DateLikeObject', { day: 15, month: 2, year: 2025 } satisfies Temporal.DateLikeObject],
			['ZonedDateTime', Temporal.ZonedDateTime.from('2025-02-15T10:15:30+11:00[Australia/Sydney]')],
		])('%s', ([_, input]) => {
			expect(formatDate(input, { locale: 'en-AU' })).toBe('15 Feb 2025');
		});
	});

	describe('Rejects anything other than a calendar date', () => {
		test.for([
			['UTC instant', '2026-01-01T00:00:00Z'],
			['Date-time with numeric offset', '2026-01-01T00:00:00+00:00'],
			['Postgres timestamptz output', '2026-01-01 00:00:00+00'],
			['Zoned date-time', '2026-01-01T00:00:00+11:00[Australia/Sydney]'],
			['Date-time without offset', '2026-01-01T00:00:00'],
			['Nonexistent date', '2026-02-30'],
			['Empty string', ''],
		])('%s', ([_, input]) => {
			expect(() => formatDate(input, { locale: 'en-AU' })).toThrow();
		});
	});

	describe('options', () => {
		describe('omitCurrentYearIn', () => {
			const today = Temporal.Now.plainDateISO('UTC');

			test('Includes the current year by default', () =>
				expect(formatDate(today, { locale: 'en-AU' })).toContain(today.year));

			test('Omits the current year when a timezone is given', () =>
				expect(formatDate(today, { locale: 'en-AU', omitCurrentYearIn: 'UTC' })).not.toContain(
					today.year,
				));

			test('Includes the year when the date is not in the current year', () =>
				expect(formatDate('2025-01-15', { locale: 'en-US', omitCurrentYearIn: 'UTC' })).toContain(
					'2025',
				));

			describe('Current year is evaluated in the given timezone', () => {
				afterAll(() => vi.restoreAllMocks());
				beforeAll(() => {
					vi.spyOn(Temporal.Now, 'plainDateISO').mockImplementation((zone = 'UTC') => {
						// 07:00 on 1 Jan 2027 in Sydney; still 31 Dec 2026 in New York
						const now = Temporal.Instant.from('2026-12-31T20:00:00Z');
						return now.toZonedDateTimeISO(zone).toPlainDate();
					});
				});

				test.for([
					['2027-01-01', 'Australia/Sydney', '1 Jan'],
					['2026-12-31', 'Australia/Sydney', '31 Dec 2026'],
					['2026-12-31', 'America/New_York', '31 Dec'],
					['2027-01-01', 'America/New_York', '1 Jan 2027'],
				])('%s in %s → %s', ([iso, timezone, expected]) =>
					expect(formatDate(iso, { locale: 'en-AU', omitCurrentYearIn: timezone })).toBe(expected),
				);
			});
		});
	});

	test('Formats date differently for different locales', () => {
		const AU = formatDate('2026-01-15', { locale: 'en-AU' });
		const DE = formatDate('2026-01-15', { locale: 'de' });
		expect(AU).not.toBe(DE);
	});
});
