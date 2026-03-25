import { NextResponse } from 'next/server';

import { fetchClients } from '@/lib/data/client';

import { type ApiResponse, type RouteResponse } from '..';

// Helper that simulates calling the function without params (overloaded function)
const _inferData = () => fetchClients();
export type Data = Awaited<ReturnType<typeof _inferData>>;

export async function GET(): RouteResponse<Data> {
	try {
		const clients = await fetchClients();

		const response: ApiResponse<Data> = { success: true, data: clients };
		return NextResponse.json(response);
	} catch (error) {
		console.error(error);
		// This will likely be rejected auth.
		// Will eventually be rewritten to separate auth and data fetching.
		const response: ApiResponse<null> = { success: false, error: 'Failed to fetch clients' };
		return NextResponse.json(response, { status: 500 });
	}
}
