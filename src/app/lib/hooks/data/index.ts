'use client';

import { type ClientResponse } from 'hono/client';
import { type StatusCode } from 'hono/utils/http-status';
import { registerCountry } from 'lib-address';
import _useSWR, { type SWRConfiguration, type SWRResponse } from 'swr';
import _useSWRImmutable from 'swr/immutable';

import { type Address, AddressMetadata } from '@/api/dto/address';
import { type Client } from '@/api/dto/client';
import { type Config as ConfigData } from '@/api/dto/config';
import { type Invoice } from '@/api/dto/invoice';
import { client } from '@/lib/api';
import { type EntityData, parseAPIRes } from '@/lib/api/parse-api-response';

import { useMutateClient } from './mutate';

type Config = Omit<SWRConfiguration, 'fallbackData'>;
type Requester = ClientResponse<unknown, StatusCode, string>;

/** Wraps a SWR hook to issue a Hono client request and unwrap its `{ data }` envelope. */
function makeWrapper(hook: typeof _useSWR) {
	return <R extends Requester, T = EntityData<R>, C extends Config = Config>(
		key: string,
		requester: () => R | Promise<R>,
		initial?: T,
		config?: C,
		transform?: (data: EntityData<R>) => T,
	) =>
		hook(
			key,
			async () => {
				const data = await parseAPIRes(requester());
				return (transform ? transform(data) : data) as T;
			},
			{
				...config,
				...(initial !== undefined ? { fallbackData: initial } : {}),
			},
		) as SWRResponse<T, unknown, C>;
}

const useSWR = makeWrapper(_useSWR);
const useSWRImmutable = makeWrapper(_useSWRImmutable);

export const useInvoices = <C extends Config>(initial?: Invoice[], config?: C) =>
	useSWR(
		client.invoices.$path({ query: {} }),
		() => client.invoices.$get({ query: {} }),
		initial,
		config,
	);

export const useClientInvoices = <C extends Config>(id: string, initial?: Invoice[], config?: C) =>
	useSWR(
		client.invoices.$path({ query: { client: id } }),
		() => client.invoices.$get({ query: { client: id } }),
		initial,
		config,
	);

export const useConfig = <C extends Config>(initial?: ConfigData, config?: C) =>
	useSWR(client.config.$path(), () => client.config.$get(), initial, config);

export const useClients = <C extends Config>(initial?: Client[], config?: C) =>
	useSWR(
		client.clients.$path({ query: {} }),
		() => client.clients.$get({ query: {} }),
		initial,
		config,
	);

export function useClient<C extends Config>(id: string, initial?: Client, config?: C) {
	const swr = useSWR(
		client.clients[':id'].$path({ param: { id } }),
		() => client.clients[':id'].$get({ param: { id } }),
		initial,
		config,
	);
	const { mutate } = useMutateClient(id);

	return {
		get data() {
			return swr.data;
		},
		get error() {
			return swr.error;
		},
		get isLoading() {
			return swr.isLoading;
		},
		get isValidating() {
			return swr.isValidating;
		},
		mutate,
	};
}

export { useAddressMetadata };

/** Pulls data from the local wrapper around Google Address Metadata API. */
function useAddressMetadata<C extends Config>(
	countryCode: Address['country'],
	initial?: AddressMetadata,
	config?: C,
) {
	const swr = useSWRImmutable(
		client.address.metadata[':country'].$path({ param: { country: countryCode } }),
		() => client.address.metadata[':country'].$get({ param: { country: countryCode } }),
		initial,
		config,
	);

	if (swr.data) registerCountry(AddressMetadata.parse(swr.data));

	return swr;
}
