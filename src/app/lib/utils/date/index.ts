import { TZDate, tz } from '@date-fns/tz';
import { intlFormat, parseISO } from 'date-fns';

// date-fns can both convert (for this instant in time zone A, what time was it in time zone B)
// and transpose (alter the time zone without changing the wall time)

// This utility should transpose when no timezone is specified (ie. assume string is provided in correct local time)
// and convert when a timezone is specified (ie. assume that the string is not lying)

/** Accepts an ISO string and returns a TZDate */
export const isoToTZDate = (iso: string, timezone: string): TZDate =>
	parseISO(iso, { in: tz(timezone) });

export type FormatDateOptions = {
	locale: string;

	/** Whether to include or omit the year when the printed date occurs this year */
	printCurrentYear?: boolean;
	/** Whether to include the time in the output string */
	time?: boolean;
};

/** Accepts a date with timezone, and formats a printable string according to the provided locale
 *
 * @example formatDate('2026-01-01', 'Australia/Sydney', {locale: 'en-AU'})
 * @example
 * const date = new TZDate(2026, 0, 1, 'Australia/Sydney');
 * formatDate(date, {locale: 'en-AU'})
 */
export function formatDate(date: TZDate, options: FormatDateOptions): string;
export function formatDate(iso: string, timezone: string, options: FormatDateOptions): string;
export function formatDate(
	...args: [TZDate, FormatDateOptions] | [string, string, FormatDateOptions]
): string {
	const [date, options] =
		args.length === 3 ? [isoToTZDate(args[0], args[1]), args[2]] : [args[0], args[1]];

	const { locale, printCurrentYear = true, time = false } = options;

	const timezone = date.timeZone;
	if (!timezone) throw new Error('Timezone is required. Ensure date is a TZDate');

	const isDateThisYear = date.getFullYear() === new TZDate(new Date(), timezone).getFullYear();

	return intlFormat(
		date,
		{
			timeZone: timezone,
			day: 'numeric',
			month: 'short',
			year: printCurrentYear || !isDateThisYear ? 'numeric' : undefined,
			hour: time ? 'numeric' : undefined,
			minute: time ? 'numeric' : undefined,
		},
		{ locale },
	);
}
