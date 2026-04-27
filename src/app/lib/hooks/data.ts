'use client';

import _useSWR, { type SWRConfiguration, type SWRResponse } from 'swr';
import _useSWRImmutable from 'swr/immutable';

import { fetcher } from '@/api';

//
//
// SWR helpers

type Config = Omit<SWRConfiguration, 'fallbackData'>;
type Response<T, C> = SWRResponse<T, unknown, C> & { isError: boolean };

/** Wraps a SWR hook to handle custom application behaviour */
function makeWrapper(hook: typeof _useSWR) {
	return <T, C extends Config>(key: string, initial?: T, config?: C) => {
		const swr = hook(key, fetcher<T>, {
			...config,
			...(initial !== undefined ? { fallbackData: initial } : {}),
		});

		// Assertion is used to restore discriminated types after forming new object
		return { ...swr, isError: swr.error !== undefined } as Response<T, C>;
	};
}

const useSWR = makeWrapper(_useSWR);
const useSWRImmutable = makeWrapper(_useSWRImmutable);

//
//
// Data fetching hooks

import { type Data as InvoiceData } from '@/api/invoices/route';
export const useInvoices = <C extends Config>(initial?: InvoiceData, config?: C) =>
	useSWR('/api/invoices', initial, config);

export const useClientInvoices = <C extends Config>(
	id: string,
	initial?: InvoiceData,
	config?: C,
) => useSWR(`/api/invoices?client=${id}`, initial, config);

import { type Data as ConfigData } from '@/api/config/route';
export const useConfig = <C extends Config>(initial?: ConfigData, config?: C) =>
	useSWR('/api/config', initial, config);

import { type Data as ClientsData } from '@/api/clients/route';
export const useClients = <C extends Config>(initial?: ClientsData, config?: C) =>
	useSWR('/api/clients', initial, config);

import { type Data as ClientData } from '@/api/clients/[id]/route';
export const useClient = <C extends Config>(id: string, initial?: ClientData, config?: C) =>
	useSWR(`/api/clients/${id}`, initial, config);

import { type CountryCode, registerCountry } from 'lib-address';

import { type Data as AddressInputMetadata } from '@/api/address-metadata/[country]/route';

export { type AddressInputMetadata as AddressMetadata, useAddressMetadata };

/** Pulls data from lib wrapper around Google Address Metadata API */
function useAddressMetadata<C extends Config>(
	countryCode: CountryCode,
	initial?: AddressInputMetadata,
	config?: C,
) {
	const swr = useSWRImmutable(`/api/address-metadata/${countryCode}`, initial, config);

	// This idempotent side-effect must take place inside hook lifecycle
	// to allow the calling component to rely on registration during render
	if (swr.data) registerCountry(swr.data);

	return swr;
}
