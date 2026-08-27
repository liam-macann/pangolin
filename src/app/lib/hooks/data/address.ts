import { useSuspenseQuery } from '@tanstack/react-query';
import { type InferResponseType } from 'hono/client';
import { registerCountry } from 'lib-address';

import rpc from '#rpc';
import { type Address, AddressMetadata } from '@/api/dto/address';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { declareQueries, type QueryOptionsFor } from './helpers';

export const addressKeys = {
	all: ['address'] as const,
	metadata: (country: Address['country']) => ['address', 'metadata', { country }] as const,
};

export const addressQueries = declareQueries({
	metadata: (country: Address['country']) => ({
		queryKey: addressKeys.metadata(country),
		queryFn: async ({ signal }) => {
			const response = await parseAPIRes(
				rpc.address.metadata[':country'].$get({ param: { country } }, { init: { signal } }),
			);
			registerCountry(AddressMetadata.parse(response.data));
			return response;
		},
		staleTime: Infinity,
	}),
});

type AddressMetadataResponse = InferResponseType<
	(typeof rpc.address.metadata)[':country']['$get'],
	200
>;

export function useAddressMetadata<TData = AddressMetadataResponse>(
	country: Address['country'],
	options?: QueryOptionsFor<AddressMetadataResponse, TData>,
) {
	const initialData =
		typeof options?.initialData === 'function' ? options.initialData() : options?.initialData;

	if (initialData?.data.key === country) registerCountry(AddressMetadata.parse(initialData.data));

	return useSuspenseQuery({ ...addressQueries.metadata(country), ...options });
}
