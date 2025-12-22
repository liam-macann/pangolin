import { NextResponse } from 'next/server';
import { getCurrencies } from '@/lib/data';
import type { ApiResponse, RouteResponse } from '../types';

export type Data = Awaited<ReturnType<typeof getCurrencies>>;

export async function GET(): RouteResponse<Data> {
	try {
		const currencies = await getCurrencies();

		const response: ApiResponse<Data> = { success: true, data: currencies };
		return NextResponse.json(response, {
			headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
		});
	} catch (error) {
		console.error(error);

		const response: ApiResponse<null> = { success: false, error: 'Failed to fetch currencies' };
		return NextResponse.json(response, { status: 500 });
	}
}
