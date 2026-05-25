import { unstable_rethrow } from 'next/navigation';
import { NextResponse } from 'next/server';

import { type ApiResponse, type RouteResponse } from '@/api';
import { fetchClients } from '@/lib/data/client';

// Helper that simulates calling the function without params (overloaded function)
const _inferData = () => fetchClients();
export type Data = Awaited<ReturnType<typeof _inferData>>;

export async function GET(): RouteResponse<Data> {
	try {
		const clients = await fetchClients();

		const response: ApiResponse<Data> = { success: true, data: clients };
		return NextResponse.json(response);
	} catch (error) {
		unstable_rethrow(error);

		console.error(error);
		const response: ApiResponse<null> = { success: false, error: 'Failed to fetch clients' };
		return NextResponse.json(response, { status: 500 });
	}
}
