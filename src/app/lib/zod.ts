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
					// Spaces and apostrophes are unambiguous thousands separators — strip them first.
					// eg. "1 234 567,89" || "1'234'567.89" → "1234567.89"
					const normalized = val.replaceAll(/[\s']/g, '');

					// Count the number of commas and periods in the normalized string
					const commas = normalized.match(/,/g)?.length ?? 0;
					const periods = normalized.match(/\./g)?.length ?? 0;

					const isCommaDecimal =
						// If there is exactly one comma, and there is no period after it, infer comma-decimal formatting
						(commas === 1 && normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) ||
						// If there is no comma but multiple periods, infer that the period character is a thousands separator
						(commas === 0 && periods > 1);

					const isPeriodDecimal =
						!isCommaDecimal &&
						// If there is exactly one period, and there is no comma after it, infer period-decimal formatting
						((periods === 1 && normalized.lastIndexOf('.') > normalized.lastIndexOf(',')) ||
							// If there is no period but multiple commas, infer that the comma character is a thousands separator
							(periods === 0 && commas > 1));

					if (isCommaDecimal) {
						// Remove all periods (thousand separators) and replace the decimal comma with a period
						return normalized.replaceAll('.', '').replace(',', '.').trim();
					} else if (isPeriodDecimal) {
						// Otherwise, for period decimals, strip all commas (thousand separators)
						return normalized.replaceAll(',', '').trim();
					}

					return normalized;
				}

				return val;
			})
			.pipe(z.coerce.number(error))
			.pipe(schema || z.number())
	);
}
