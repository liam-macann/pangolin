export const formatCurrency = (amount: number, locale: string) => {
	return amount.toLocaleString(locale, {
		style: 'currency',
		currency: 'AUD',
	});
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

export const generatePagination = (currentPage: number, totalPages: number) => {
	// If the total number of pages is 7 or less,
	// display all pages without any ellipsis.
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	// If the current page is among the first 3 pages,
	// show the first 3, an ellipsis, and the last 2 pages.
	if (currentPage <= 3) {
		return [1, 2, 3, '...', totalPages - 1, totalPages];
	}

	// If the current page is among the last 3 pages,
	// show the first 2, an ellipsis, and the last 3 pages.
	if (currentPage >= totalPages - 2) {
		return [1, 2, '...', totalPages - 2, totalPages - 1, totalPages];
	}

	// If the current page is somewhere in the middle,
	// show the first page, an ellipsis, the current page and its neighbors,
	// another ellipsis, and the last page.
	return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
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
