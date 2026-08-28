import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { type InferResponseType } from 'hono/client';
import { registerCountry } from 'lib-address';

import rpc from '#rpc';
import { type Address, AddressMetadata } from '@/api/dto/address';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { type SuspenseOptions } from './helpers';

export const addressQueries = {
	rootKey: () => ['address'] as const,

	metadataKey: (country: Address['country']) =>
		[...addressQueries.rootKey(), 'metadata', { country }] as const,
	metadata: (country: Address['country']) =>
		queryOptions({
			queryKey: addressQueries.metadataKey(country),
			queryFn: async ({ signal }) => {
				const response = await parseAPIRes(
					rpc.address.metadata[':country'].$get({ param: { country } }, { init: { signal } }),
				);
				registerCountry(AddressMetadata.parse(response.data));
				return response;
			},
			staleTime: Infinity,
		}),
};

type AddressMetadataResponse = InferResponseType<
	(typeof rpc.address.metadata)[':country']['$get'],
	200
>;
type AddressMetadataOptions<TData> = SuspenseOptions<
	AddressMetadataResponse,
	ReturnType<typeof addressQueries.metadataKey>,
	TData
>;

export function useAddressMetadata<TData = AddressMetadataResponse>(
	country: Address['country'],
	options?: AddressMetadataOptions<TData>,
) {
	const initialData =
		typeof options?.initialData === 'function' ? options.initialData() : options?.initialData;

	if (initialData?.data.key === country) registerCountry(AddressMetadata.parse(initialData.data));

	return useSuspenseQuery({
		...addressQueries.metadata(country),
		...options,
		select: options?.select,
	});
}
