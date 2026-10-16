import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { registerCountry } from 'lib-address';

import rpc from '#rpc';
import { type Address, AddressMetadata } from '@/api/dto/address';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { composeSelect, type QueryOptions } from './helpers';

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
			select: response => response.data,
		}),
};

export const useAddressMetadata = <TSelect>(
	country: Address['country'],
	opts?: QueryOptions<typeof addressQueries.metadata, TSelect>,
) => {
	const initial = typeof opts?.initialData === 'function' ? opts.initialData() : opts?.initialData;

	if (initial?.data.key === country) registerCountry(AddressMetadata.parse(initial.data));

	const { select, ...query } = addressQueries.metadata(country);
	return useSuspenseQuery({ ...query, ...opts, select: composeSelect(select, opts) });
};
