import { NextResponse } from 'next/server';
import { fetchClients } from '@/lib/data';
import type { ApiResponse, RouteResponse } from '../types';

export type Data = Awaited<ReturnType<typeof fetchClients>>;

export async function GET(): RouteResponse<Data> {
	try {
		const clients = await fetchClients();

		const response: ApiResponse<Data> = { success: true, data: clients };
		return NextResponse.json(response);
	} catch (error) {
		console.error(error);
		// This will likely be rejected auth, as fetchClients throws a redirect via auth().
		// This will eventually be rewritten to separate auth and data fetching.
		const response: ApiResponse<null> = { success: false, error: 'Failed to fetch clients' };
		return NextResponse.json(response, { status: 500 });
	}
}
