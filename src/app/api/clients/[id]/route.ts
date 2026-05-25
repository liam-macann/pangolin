import { unstable_rethrow } from 'next/navigation';
import { NextResponse } from 'next/server';

import { type ApiResponse, type RouteResponse } from '@/api';
import { fetchClients } from '@/lib/data/client';

// Helper that simulates calling the function without params (overloaded function)
const _inferData = (id: string) => fetchClients(id);
export type Data = Awaited<ReturnType<typeof _inferData>>;

export async function GET(
	_request: Request,
	{ params }: RouteContext<'/api/clients/[id]'>,
): RouteResponse<Data> {
	try {
		const { id } = await params;

		const client = await fetchClients(id);

		const response: ApiResponse<Data> = { success: true, data: client };
		return NextResponse.json(response);
	} catch (error) {
		unstable_rethrow(error);

		console.error(error);
		const response: ApiResponse<null> = { success: false, error: 'Failed to fetch client' };
		return NextResponse.json(response, { status: 500 });
	}
}
