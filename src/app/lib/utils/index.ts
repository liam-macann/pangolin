import { type invoices, type numberingScheme } from '@/db/schema';

import { type ElementType } from './type';

export * from './type';

export const formatNumber = (amount: number, locale: string) => {
	return new Intl.NumberFormat(locale, {
		style: 'decimal',
	}).format(amount);
};

/** Converts a user-facing percentage to its stored fractional rate: 15.5 → 0.155 */
export const percentToRate = (percent: number) => Math.round(percent * 100) / 10_000;

/** Converts a fractional rate as stored in the database to user-facing percentage: 0.155 → 15.5.
 * @remarks Rounding to the storage scale avoids floating-point artefacts. */
export const rateToPercent = (rate: number) => Math.round(rate * 10_000) / 100;

export const invoiceReference = (
	invoice: Pick<typeof invoices.$inferSelect, 'index' | 'yearIndex' | 'issueYear'>,
	scheme: ElementType<typeof numberingScheme.enumValues>,
) => {
	if (invoice.index < 0 || invoice.yearIndex < 0)
		throw new Error('Index and yearIndex must be non-negative');

	switch (scheme) {
		case 'sequential':
			return `INV-${invoice.index.toString().padStart(3, '0')}`;
		case 'annual':
			return `${invoice.issueYear}-${invoice.yearIndex.toString().padStart(3, '0')}`;
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
