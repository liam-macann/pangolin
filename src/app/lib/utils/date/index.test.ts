import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { formatDate, isoToTZDate } from '@/lib/utils/date';

describe('isoToTZDate', () => {
	describe('Set timeZone property of TZDate after transposition', () => {
		test.for([{ timezone: 'UTC' }, { timezone: 'Asia/Kolkata' }, { timezone: 'America/New_York' }])(
			'Sets .timeZone to $timezone',
			({ timezone }) => expect(isoToTZDate('2026-01-15', timezone).timeZone).toBe(timezone),
		);
	});

	describe('Date-only string interpreted as midnight in timezone', () => {
		// TZDate.toISOString() serializes with an explicit zone offset (not Z, which indicates UTC)
		test.for([
			{ iso: '2026-01-15', timezone: 'UTC', expected: '2026-01-15T00:00:00.000+00:00' },
			{ iso: '2026-01-15', timezone: 'Asia/Kolkata', expected: '2026-01-15T00:00:00.000+05:30' },
			{
				iso: '2026-01-15',
				timezone: 'America/New_York',
				expected: '2026-01-15T00:00:00.000-05:00',
			},
			{
				iso: '2026-01-01',
				timezone: 'Australia/Sydney',
				expected: '2026-01-01T00:00:00.000+11:00',
			},
		])('$iso in $timezone', ({ iso, timezone, expected }) =>
			expect(isoToTZDate(iso, timezone).toISOString()).toBe(expected),
		);

		test('Same date-only string in different zones produce different instants', () => {
			const utc = isoToTZDate('2026-01-15', 'UTC');
			const kolkata = isoToTZDate('2026-01-15', 'Asia/Kolkata');
			expect(utc.getTime()).not.toBe(kolkata.getTime());
		});
	});

	describe('Datetime string with timezone is converted to target timezone', () => {
		test.for([
			{
				iso: '2026-01-15T00:00:00Z',
				timezone: 'America/New_York',
				expected: '2026-01-14T19:00:00.000-05:00',
			},
			{
				iso: '2026-01-15T12:00:00+05:30',
				timezone: 'UTC',
				expected: '2026-01-15T06:30:00.000+00:00',
			},
		])('$iso in $timezone → $expected', ({ iso, timezone, expected }) =>
			expect(isoToTZDate(iso, timezone).toISOString()).toBe(expected),
		);

		test('Set timeZone property of TZDate after conversion', () =>
			expect(isoToTZDate('2026-01-15T00:00:00Z', 'America/New_York').timeZone).toBe(
				'America/New_York',
			));
	});
});

describe('formatDate', () => {
	describe('Date-only strings print the same calendar date in every timezone', () => {
		test.for([
			'UTC',
			'Pacific/Pago_Pago',
			'America/New_York',
			'Australia/Sydney',
			'Pacific/Kiritimati',
			'Asia/Kathmandu',
		])('%s', timezone =>
			expect(formatDate('2025-02-15', timezone, { locale: 'en-AU' })).toBe('15 Feb 2025'),
		);

		test('On a day where DST skips midnight', () =>
			expect(formatDate('2026-09-06', 'America/Santiago', { locale: 'en-US' })).toBe(
				'Sep 6, 2026',
			));
	});

	describe('options', () => {
		describe('printCurrentYear', () => {
			const now = isoToTZDate(new Date().toISOString(), 'UTC');
			const currentYear = now.getUTCFullYear();
			const nowISO = now.toISOString();

			test.for([
				['Includes year by default', undefined, true],
				['Includes year when true', true, true],
				['Omits year when false and date is current year', false, false],
			] as const)('%s', ([_, printCurrentYear, expected]) => {
				const result = formatDate(nowISO, 'UTC', { locale: 'en-AU', printCurrentYear });
				expected
					? expect(result).toContain(currentYear)
					: expect(result).not.toContain(currentYear);
			});

			test('Includes year when false and date is not current year', () =>
				expect(
					formatDate('2025-01-15', 'UTC', { locale: 'en-US', printCurrentYear: false }),
				).toContain('2025'));

			describe('Current year is evaluated in the date timezone', () => {
				// 07:00 on 1 Jan 2027 in Sydney; still 31 Dec 2026 in UTC and New York
				beforeAll(() =>
					vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-12-31T20:00:00Z') }),
				);
				afterAll(() => vi.useRealTimers());

				test.for([
					['2027-01-01', 'Australia/Sydney', '1 Jan'],
					['2026-12-31', 'Australia/Sydney', '31 Dec 2026'],
					['2026-12-31', 'America/New_York', '31 Dec'],
					['2027-01-01', 'America/New_York', '1 Jan 2027'],
				])('%s in %s → %s', ([iso, timezone, expected]) =>
					expect(formatDate(iso, timezone, { locale: 'en-AU', printCurrentYear: false })).toBe(
						expected,
					),
				);
			});
		});
	});

	test('Formats date differently for different locales', () => {
		expect(formatDate('2026-01-15', 'UTC', { locale: 'en-AU' })).not.toBe(
			formatDate('2026-01-15', 'UTC', { locale: 'de' }),
		);
	});
});
