import type { invoices, numberingScheme } from '@/db/schema';

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

export const formatDateToLocal = (
	date: string | Date,
	time: boolean = false,
	locale: string = 'en-AU',
) => {
	const safeDate = new Date(date);
	const options: Intl.DateTimeFormatOptions = {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: time ? 'numeric' : undefined,
		minute: time ? 'numeric' : undefined,
	};
	const formatter = new Intl.DateTimeFormat(locale, options);
	return formatter.format(safeDate);
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

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

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
