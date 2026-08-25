'use client';

import {
	type DefaultError,
	type QueryFunctionContext,
	type UseMutationOptions,
	useMutation,
	useSuspenseQuery,
} from '@tanstack/react-query';

import { type Invoice } from '@/api/dto/invoice';
import { client } from '@/lib/api';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import {
	invalidateKeys,
	type ListResponse,
	type QueryOptionsFor,
	withInvalidation,
} from './helper';

export const invoiceKeys = {
	all: ['invoices'] as const,
	lists: () => ['invoices', 'list'] as const,
	list: (clientId?: string) => ['invoices', 'list', { client: clientId ?? null }] as const,
};

function invoicesQuery(clientId?: string) {
	return {
		queryKey: invoiceKeys.list(clientId),
		queryFn: ({ signal }: QueryFunctionContext) =>
			parseAPIRes(
				client.invoices.$get({ query: clientId ? { client: clientId } : {} }, { init: { signal } }),
			),
	};
}

export const useInvoices = <TData = ListResponse<Invoice>>(
	options?: QueryOptionsFor<ListResponse<Invoice>, TData>,
) => useSuspenseQuery({ ...invoicesQuery(undefined), ...options });

export const useClientInvoices = <TData = ListResponse<Invoice>>(
	clientId: string,
	options?: QueryOptionsFor<ListResponse<Invoice>, TData>,
) => useSuspenseQuery({ ...invoicesQuery(clientId), ...options });

export function useInvoiceMutation<
	TData = unknown,
	TError = DefaultError,
	TVariables = void,
	TOnMutateResult = unknown,
>(options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult>) {
	return useMutation(
		withInvalidation(options, queryClient => invalidateKeys(queryClient, [invoiceKeys.all])),
	);
}
