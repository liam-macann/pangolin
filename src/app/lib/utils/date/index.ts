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

/** Accepts an ISO string and formats a printable string in the provided timezone and locale. */
export function formatDate(iso: string, timezone: string, options: FormatDateOptions): string {
	const date = isoToTZDate(iso, timezone);
	const { locale, printCurrentYear = true, time = false } = options;

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
