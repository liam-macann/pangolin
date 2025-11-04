import { z } from 'zod';

/** Coerce a string to a number, handling both comma and period delimited decimals, and rejecting empty strings */
export function intlNumber(schema: z.ZodNumber, error: string) {
	return (
		z
			.any()
			// 1. Sanitize the string based on the position of separators
			.transform(val => {
				if (typeof val === 'string') {
					// We want to support both comma and period delimited decimals.
					// eg. "20,5" → "20.5"
					//
					// Both separators may be present in a numeric string, as the inverse is used
					// for thousands separation (although beyond max for this schema)
					// eg. "1.200,5" || "1,200.5" → "1200.5"
					//

					// Use the last separator to infer the formatting.
					const commaDecimal = val.includes(',') && val.lastIndexOf(',') > val.lastIndexOf('.');

					if (commaDecimal) {
						// Remove all periods (thousand separators) and replace the decimal comma with a period
						return val.replace(/\./g, '').replace(',', '.');
					} else {
						// Otherwise, for period decimals, strip all commas (thousand separators)
						return val.replace(/,/g, '');
					}
				} else return val;
			})
			.transform((val, ctx) => {
				if (val === '') {
					ctx.issues.push({ code: 'custom', message: error, input: val });
					return z.NEVER;
				}

				return z.coerce.number(error).parse(val);
			})
			.pipe(schema)
	);
}
