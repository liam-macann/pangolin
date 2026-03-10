import { z } from 'zod';

type ErrorParam = string | z.core.$ZodCustomParams;
type IntlNumber = ReturnType<typeof buildIntlNumber>;

// Overloads to prevent need to pass object (closer to Zod idioms)
export function intlNumber(schema: z.ZodNumber, error: ErrorParam): IntlNumber;
export function intlNumber(schema: z.ZodNumber): IntlNumber;
export function intlNumber(error: ErrorParam): IntlNumber;
export function intlNumber(): IntlNumber;

/** Coerce a string to a number, handling both comma and period delimited decimals, and rejecting empty strings */
export function intlNumber(arg1?: z.ZodNumber | ErrorParam, arg2?: ErrorParam) {
	const hasSchema = arg1 instanceof z.ZodType;

	return buildIntlNumber({
		error: hasSchema ? arg2 : arg1,
		schema: hasSchema ? arg1 : z.number(),
	});
}

function buildIntlNumber({ schema, error }: { schema?: z.ZodNumber; error?: ErrorParam }) {
	return (
		z
			.union([z.string(), z.number()])
			// Ensure input is not blank (this will otherwise be coerced to `0`)
			.refine(val => val !== '', error)
			// Sanitize the string based on the position of separators
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
					const isCommaDecimal = val.includes(',') && val.lastIndexOf(',') > val.lastIndexOf('.');

					if (isCommaDecimal) {
						// Remove all periods (thousand separators) and replace the decimal comma with a period
						return val.replaceAll('.', '').replace(',', '.').trim();
					} else {
						// Otherwise, for period decimals, strip all commas (thousand separators)
						return val.replaceAll(',', '').trim();
					}
				}

				return val;
			})
			.pipe(z.coerce.number(error))
			.pipe(schema || z.number())
	);
}
