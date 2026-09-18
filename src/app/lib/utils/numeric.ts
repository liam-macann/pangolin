import z from 'zod/v4';

const decimalRegex = /^-?\d+(?:\.\d+)?$/;

/** Validates plain decimal syntax without converting the value to a JavaScript number.
 * @see {@link NumericString} */
export const isNumericString = (value: string): value is NumericString => decimalRegex.test(value);

/**
 * Plain base-10 decimal text
 *
 * @remarks Runtime validation accepts (positive and negative) decimal and integer values,
 * without converting through `number`.
 *
 * The inferred `${number}` is an ergonomic approximation to allow typed literals.
 * TypeScript may accept radix or exponent syntax, and reject values beyond its finite range.
 */
export type NumericString = `${number}`;
export const NumericString = z.toZod<NumericString>()(
	z.string().regex(decimalRegex).refine(isNumericString),
);

/** Represents a numeric value that can be a number, or a string representation of a number. */
export type Numeric = number | NumericString;

/** Accepts a {@link Numeric} and a formatter, and returns the formatted value */
export const formatNumeric = (value: Numeric, formatter: Intl.NumberFormat) => {
	if (typeof value === 'number' || isNumericString(value)) return formatter.format(value);
	throw new TypeError(`Invalid numeric value: ${value}`);
};
