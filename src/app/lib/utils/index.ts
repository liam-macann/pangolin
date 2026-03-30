import { type TZDate } from '@date-fns/tz';
import { intlFormat } from 'date-fns';

import { type invoices, type numberingScheme } from '@/db/schema';

export const formatCurrency = (amount: number, currency: string, locale: string) => {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency,
	}).format(amount);
};

export const getCurrencySymbol = (currency: string, locale: string): string | undefined =>
	new Intl.NumberFormat(locale, { style: 'currency', currency })
		.formatToParts(1)
		.find(x => x.type === 'currency')?.value;

export const formatNumber = (amount: number, locale: string) => {
	return new Intl.NumberFormat(locale, {
		style: 'decimal',
	}).format(amount);
};

export const getTimezoneTime = (tz: string) =>
	new Date(new Date().toLocaleString(undefined, { timeZone: tz }));

export const invoiceReference = (
	invoice: Pick<typeof invoices.$inferSelect, 'index' | 'yearIndex' | 'issueYear'>,
	scheme: ElementType<typeof numberingScheme.enumValues>,
) => {
	switch (scheme) {
		case 'sequential':
			return `INV-${invoice.index.toString().padStart(3, '0')}`;
		case 'annual':
			return `${invoice.issueYear}-${invoice.yearIndex.toString().padStart(3, '0')}`;
		default:
			throw new Error(`Undefined scheme: ${scheme}`);
	}
};

export const formatDateToLocal = (date: TZDate, time: boolean, locale: string) => {
	const tz = date.timeZone;
	if (!tz) throw new Error('Timezone is required. Ensure date is a TZDate');

	return intlFormat(
		date,
		{
			timeZone: tz,
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: time ? 'numeric' : undefined,
			minute: time ? 'numeric' : undefined,
		},
		{ locale },
	);
};

// Localisation is irrelevant as we only target English
const pluralRules = new Intl.PluralRules('en-GB');
/** Accepts a number, and returns either singular or plural form */
export function pluralize(count: number, singular: string, plural: string) {
	const form = pluralRules.select(count);

	switch (form) {
		case 'one':
			return singular;
		case 'other':
			return plural;
		default:
			throw new Error(`Unknown: ${form}`);
	}
}

// From NPM package `merge-refs`
/**
 * A function that merges React refs into one.
 * Supports both functions and ref objects created using createRef() and useRef().
 *
 * Usage:
 * ```tsx
 * <div ref={mergeRefs(ref1, ref2, ref3)} />
 * ```
 *
 * @param {(React.Ref<T> | undefined)[]} inputRefs Array of refs
 * @returns {React.Ref<T> | React.RefCallback<T>} Merged refs
 */
export default function mergeRefs<T>(
	...inputRefs: (React.Ref<T> | undefined)[]
): React.Ref<T> | React.RefCallback<T> {
	const filteredInputRefs = inputRefs.filter(Boolean);

	if (filteredInputRefs.length <= 1) {
		const firstRef = filteredInputRefs[0];

		return firstRef || null;
	}

	return function mergedRefs(ref) {
		for (const inputRef of filteredInputRefs) {
			if (typeof inputRef === 'function') {
				inputRef(ref);
			} else if (inputRef) {
				(inputRef as React.RefObject<T | null>).current = ref;
			}
		}
	};
}

/** Drop specified properties from an object. Returns a shallow copy. */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
	source: T,
	paths: readonly K[],
): Omit<T, K> {
	const output = { ...source };
	for (const val in paths) delete output[val];

	return output;
}

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export type ElementType<T extends Iterable<unknown>> = T extends Iterable<infer E> ? E : never;

/** Improve readability of object types */
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

/**
 * Ensures that all objects in a tuple share the **exact same keys**.
 *
 * @template T - A arbitrary-length tuple of objects `[object, object, …]`
 */
export type AllSameKeys<T extends [object, ...object[]]> = T extends [
	infer First extends object,
	...infer Rest extends object[],
]
	? Rest[number] extends First
		? First extends Rest[number]
			? T
			: never
		: never
	: never;

/** Omit properties without breaking discriminated unions */
export type OmitUnion<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

declare const __brand: unique symbol;
/** Simulate nominal typing by specifying a key */
export type Brand<T, B> = T & { [__brand]: B };
