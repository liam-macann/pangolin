export const formatCurrency = (amount: number, currency: string, locale: string) => {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency,
	}).format(amount);
};

export const formatNumber = (amount: number, locale: string) => {
	return new Intl.NumberFormat(locale, {
		style: 'decimal',
	}).format(amount);
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

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// biome-ignore lint/suspicious/noExplicitAny: Generic
export type ElementType<T extends Iterable<any>> = T extends Iterable<infer E> ? E : never;

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
