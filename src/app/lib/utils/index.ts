import { type invoices, type numberingScheme } from '@/db/schema';

import { formatNumeric, type Numeric, NumericString } from './numeric';
import { type ElementType } from './type';

export * from './type';

import { type ClassValue, clsx } from 'clsx';
import { omitBy } from 'es-toolkit';
import { twMerge } from 'tailwind-merge';
import { type SetOptional, type Simplify } from 'type-fest';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatNumber = (amount: Numeric, locale: string) => {
	const formatter = new Intl.NumberFormat(locale, { style: 'decimal' });
	return formatNumeric(amount, formatter);
};

/** Converts a user-facing percentage to its stored fractional rate: 15.5 → 0.155 */
export const percentToRate = (percent: Numeric) =>
	NumericString.parse((Math.round(Number(percent) * 100) / 10_000).toFixed(4));

/** Converts a fractional rate as stored in the database to user-facing percentage: 0.155 → 15.5.
 * @remarks Rounding to the storage scale avoids floating-point artefacts. */
export const rateToPercent = (rate: Numeric) => Math.round(Number(rate) * 10_000) / 100;

export const invoiceReference = (
	invoice: Pick<typeof invoices.$inferSelect, 'partition' | 'index'>,
	scheme: ElementType<typeof numberingScheme.enumValues>,
) => {
	if (invoice.index < 0) throw new Error('Index must be non-negative');
	const index = invoice.index.toString().padStart(3, '0');

	switch (scheme) {
		case 'sequential':
			if (invoice.partition) throw new Error('Invoice with sequential scheme was given partition');
			return `INV-${index}`;
		case 'annual':
			if (!invoice.partition) throw new Error('Invoice with annual scheme is lacking partition');
			return `${invoice.partition}-${index}`;
		default:
			throw new Error(`Undefined scheme: ${scheme}`);
	}
};

// Mulberry32
/** Deterministic PRNG (SSR-safe) */
export function seededRandom(seed: number) {
	let t = seed + 0x6d2b79f5;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Localisation is irrelevant as we only target English
const pluralRules = new Intl.PluralRules('en-GB');
/** Accepts a number, and returns either singular or plural form */
export function pluralize(count: Numeric, singular: string, plural: string) {
	const form = pluralRules.select(Number(count));

	switch (form) {
		case 'one':
			return singular;
		case 'other':
			return plural;
		default:
			throw new Error(`Unknown: ${form}`);
	}
}

type NullKeys<T> = {
	[K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

/** Removes null from object property types, converting to optional fields */
type DropNullResult<T> =
	NonNullable<T> extends infer O
		? O extends object
			? Simplify<SetOptional<{ [K in keyof O]: Exclude<O[K], null> }, NullKeys<O>>>
			: never
		: never;

/** Strips null values from an object return, returning undefined instead */
export const dropNull = <T extends Record<string, unknown> | null | undefined>(
	obj?: T,
): DropNullResult<T> | undefined => {
	if (!obj) return undefined;
	return omitBy(obj, value => value === null) as DropNullResult<T>;
};

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
export function mergeRefs<T>(
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
