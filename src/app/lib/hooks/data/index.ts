'use client';

import { type ClientResponse } from 'hono/client';
import { type StatusCode } from 'hono/utils/http-status';
import { type CountryCode, registerCountry } from 'lib-address';
import _useSWR, { type SWRConfiguration, type SWRResponse } from 'swr';
import _useSWRImmutable from 'swr/immutable';

import { client } from '@/lib/api';
import { type EntityData, parseAPIRes } from '@/lib/api/parse-api-response';
import { type Config as ConfigData } from '@/lib/data';
import { type Client } from '@/lib/data/client';
import { type Invoice } from '@/lib/data/invoice';
import { type AddressData } from '@/lib/utils/address';

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
		) as SWRResponse<T, ProblemDetails, C>;
}

const useSWR = makeWrapper(_useSWR);
const useSWRImmutable = makeWrapper(_useSWRImmutable);

/** Converts the wire-format `createdAt` (ISO string) back into the app-facing `Date`. */
function toInvoice(item: Omit<Invoice, 'createdAt'> & { createdAt: string }): Invoice {
	return { ...item, createdAt: new Date(item.createdAt) };
}

export const useInvoices = <C extends Config>(initial?: Invoice[], config?: C) =>
	useSWR(
		client.invoices.$path({ query: {} }),
		() => client.invoices.$get({ query: {} }),
		initial,
		config,
		data => data.map(toInvoice),
	);

export const useClientInvoices = <C extends Config>(id: string, initial?: Invoice[], config?: C) =>
	useSWR(
		client.invoices.$path({ query: { client: id } }),
		() => client.invoices.$get({ query: { client: id } }),
		initial,
		config,
		data => data.map(toInvoice),
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

export { type AddressData as AddressMetadata, useAddressMetadata };

/** Pulls data from the local wrapper around Google Address Metadata API. */
function useAddressMetadata<C extends Config>(
	countryCode: Exclude<CountryCode, 'ZZ'>,
	initial?: AddressData,
	config?: C,
) {
	const swr = useSWRImmutable(
		client.address.metadata[':country'].$path({ param: { country: countryCode } }),
		() => client.address.metadata[':country'].$get({ param: { country: countryCode } }),
		initial,
		config,
	);

	if (swr.data) registerCountry(swr.data);

	return swr;
}
