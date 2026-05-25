import { unstable_rethrow } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod/v4';

import { fetchInvoices } from '@/lib/data/invoice';

import { type ApiResponse, type RouteResponse } from '..';

export type Data = Awaited<ReturnType<typeof fetchInvoices>>;

export async function GET(request: NextRequest): RouteResponse<Data> {
	const params = z
		.object({
			client: z.uuid().optional().catch(undefined),
			limit: z
				.preprocess(v => Math.trunc(Number(v)), z.coerce.number().int().positive())
				.optional()
				.catch(undefined),
		})
		.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));

	try {
		const invoices = await fetchInvoices(
			params.client ? { clientData: { client: { id: { eq: params.client } } } } : undefined,
			params.limit,
		);

		const response: ApiResponse<Data> = { success: true, data: invoices };
		return NextResponse.json(response);
	} catch (error) {
		unstable_rethrow(error);

		console.error(error);
		const response: ApiResponse<null> = { success: false, error: 'Failed to fetch invoices' };
		return NextResponse.json(response, { status: 500 });
	}
}
