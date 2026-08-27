'use client';

import { type QueryFunctionContext, useSuspenseQuery } from '@tanstack/react-query';
import { registerCountry } from 'lib-address';

import rpc from '#rpc';
import { type Address, AddressMetadata } from '@/api/dto/address';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { type EntityResponse, type QueryOptionsFor } from './helpers';

export const addressKeys = {
	all: ['address'] as const,
	metadata: (country: Address['country']) => ['address', 'metadata', { country }] as const,
};

function addressMetadataQuery(country: Address['country']) {
	return {
		queryKey: addressKeys.metadata(country),
		queryFn: async ({ signal }: QueryFunctionContext) => {
			const response = await parseAPIRes(
				rpc.address.metadata[':country'].$get({ param: { country } }, { init: { signal } }),
			);
			registerCountry(AddressMetadata.parse(response.data));
			return response;
		},
		staleTime: Infinity,
	};
}

export function useAddressMetadata<TData = EntityResponse<AddressMetadata>>(
	country: Address['country'],
	options?: QueryOptionsFor<EntityResponse<AddressMetadata>, TData>,
) {
	const initialData =
		typeof options?.initialData === 'function' ? options.initialData() : options?.initialData;

	if (initialData?.data.key === country) registerCountry(AddressMetadata.parse(initialData.data));

	const query = useSuspenseQuery({ ...addressMetadataQuery(country), ...options });
	return query;
}
