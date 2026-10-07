import { Temporal } from 'temporal-polyfill';
import z from 'zod';

export type FormatDateOptions = {
	locale: string;

	/** Omits the year when the date falls within the current year of this timezone. */
	omitCurrentYearIn?: string;
};

/** Convert between `Date` and `Temporal.Instant`. */
export const toTemporal = z.codec(z.date(), z.instanceof(Temporal.Instant), {
	decode: date => Temporal.Instant.fromEpochMilliseconds(date.getTime()),
	encode: temporal => new Date(temporal.epochMilliseconds),
});

/** Accepts an ISO plain date string, and formats a printable string in the provided locale. */
export function formatDate(iso: Temporal.PlainDateLike, options: FormatDateOptions): string {
	const { locale, omitCurrentYearIn } = options;

	// Throw unless string is plain date format
	if (typeof iso === 'string') z.iso.date().parse(iso);

	const date = Temporal.PlainDate.from(iso);

	return date.toLocaleString(locale, {
		day: 'numeric',
		month: 'short',
		year:
			omitCurrentYearIn && date.year === Temporal.Now.plainDateISO(omitCurrentYearIn).year
				? undefined
				: 'numeric',
	});
}
