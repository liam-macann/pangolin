'use client';

import useSWR, { type SWRConfiguration, type SWRResponse } from 'swr';
import useSWRImmutable from 'swr/immutable';

import { fetcher } from '@/api';

type Config = Omit<SWRConfiguration, 'fallbackData'>;
type Response<T, C> = SWRResponse<T, unknown, C> & { isError: boolean };

import { type Data as InvoiceData } from '@/api/invoices/route';

export function useInvoices<C extends Config>(initial?: InvoiceData, config?: C) {
	const swr = useSWR('/api/invoices', fetcher<InvoiceData>, {
		...config,
		...(initial ? { fallbackData: initial } : {}),
	});

	// Cast necessary to maintain discriminated types
	return {
		...swr,
		isError: swr.error !== undefined,
	} as Response<InvoiceData, C>;
}

import { type Data as ClientData } from '@/api/clients/route';

export function useClients<C extends Config>(initial?: ClientData, config?: C) {
	const swr = useSWR('/api/clients', fetcher<ClientData>, {
		...config,
		...(initial ? { fallbackData: initial } : {}),
	});

	return {
		...swr,
		isError: swr.error !== undefined,
	} as Response<ClientData, C>;
}

import { type CountryCode, registerCountry } from 'lib-address';

import { type Data as AddressInputMetadata } from '@/api/address-metadata/[country]/route';

export { type AddressInputMetadata as AddressMetadata, useAddressMetadata };

/** Pulls data from lib wrapper around Google Address Metadata API */
function useAddressMetadata<C extends Config>(
	countryCode: CountryCode,
	initial?: AddressInputMetadata,
	config?: C,
) {
	const { data, ...swr } = useSWRImmutable<AddressInputMetadata>(
		`/api/address-metadata/${countryCode}`,
		fetcher,
		{
			...config,
			...(initial ? { fallbackData: initial } : {}),
		},
	);

	if (data) registerCountry(data);

	return {
		data,
		...swr,
		isError: swr.error !== undefined,
	} as Response<AddressInputMetadata, C>;
}
