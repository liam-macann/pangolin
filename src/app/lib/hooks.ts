'use client';

import useSWR, { type SWRConfiguration } from 'swr';
import type { Data as InvoiceData } from '@/api/invoices/route';
import { responseSchema } from '@/api/types';

const fetcher = async <T>(url: string): Promise<T> => {
	const res = await fetch(url);

	// Ensure response matches API contract
	const { success, data } = responseSchema.safeParse(await res.json());

	if (!success) throw new Error('Invalid response');
	if (!data.success) throw new Error('Unauthorised');

	return data.data;
};

export function useInvoices(
	initial?: InvoiceData,
	config?: Omit<SWRConfiguration, 'fallbackData' | 'suspense'>,
) {
	const { error, ...rest } = useSWR('/api/invoices', fetcher<InvoiceData>, {
		...config,
		...(initial ? { fallbackData: initial } : {}),
	});

	return {
		isError: error !== undefined,
		...rest,
	};
}
