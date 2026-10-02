import { TZDate } from '@date-fns/tz';
import { describe, expect, test } from 'vitest';

import { formatDate, isoToTZDate } from '@/lib/utils/date';

describe('isoToTZDate', () => {
	describe('Set timeZone property of TZDate after transposition', () => {
		test.for([{ timezone: 'UTC' }, { timezone: 'Asia/Kolkata' }, { timezone: 'America/New_York' }])(
			'Sets .timeZone to $timezone',
			({ timezone }) => expect(isoToTZDate('2026-01-15', timezone).timeZone).toBe(timezone),
		);
	});

	describe('Date-only string interpreted as midnight in timezone', () => {
		// TZDate.toISOString() serialises with an explicit zone offset (not Z, which indicates UTC)
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
	test('String overload and TZDate overload produce the same result', () => {
		const iso = '2026-01-15';
		const timezone = 'America/New_York';
		const options = { locale: 'en-US' };
		expect(formatDate(iso, timezone, options)).toBe(
			formatDate(isoToTZDate(iso, timezone), options),
		);
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
		});

		describe('time', () => {
			test.for([
				['Omits time by default', undefined, false],
				['Includes when time is true', true, true],
				['Omits when time is false', false, false],
			] as const)('%s', ([_, time, expected]) => {
				const result = formatDate('2026-01-15T12:01:00Z', 'UTC', { locale: 'en-AU', time });

				expected ? expect(result).toContain('12:01') : expect(result).not.toContain('12:01');
			});
		});
	});

	test('Throws when there is no timezone', () => {
		const opts = { locale: 'en-AU' };

		// @ts-expect-error: We are testing the error case
		expect(() => formatDate('2026-01-15', opts)).toThrow('Timezone is required');
		expect(() => formatDate(new TZDate(2026, 0, 15), opts)).toThrow('Timezone is required');
	});

	test('Formats date differently for different locales', () => {
		const date = isoToTZDate('2026-01-15', 'UTC');
		expect(formatDate(date, { locale: 'en-AU' })).not.toBe(formatDate(date, { locale: 'de' }));
	});
});
