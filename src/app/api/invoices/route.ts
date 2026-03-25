import { NextResponse } from 'next/server';

import { fetchInvoices } from '@/lib/data/invoice';

import { type ApiResponse, type RouteResponse } from '..';

export type Data = Awaited<ReturnType<typeof fetchInvoices>>;

export async function GET(): RouteResponse<Data> {
	try {
		const invoices = await fetchInvoices();

		const response: ApiResponse<Data> = { success: true, data: invoices };
		return NextResponse.json(response);
	} catch (error) {
		console.error(error);

		// This will likely be rejected auth, as fetchInvoices throws a redirect.
		// This will eventually be rewritten to separate auth and data fetching.
		const response: ApiResponse<null> = { success: false, error: 'Failed to fetch invoices' };
		return NextResponse.json(response, { status: 500 });
	}
}
