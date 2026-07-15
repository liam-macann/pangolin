import { unstable_rethrow } from 'next/navigation';
import { NextResponse } from 'next/server';

import { type Config, fetchConfig } from '@/lib/data';

import { type ApiResponse, type RouteResponse } from '..';

export type Data = Config;

export async function GET(): RouteResponse<Data> {
	try {
		const data = await fetchConfig();

		const response: ApiResponse<Data> = { success: true, data };
		return NextResponse.json(response);
	} catch (error) {
		unstable_rethrow(error);

		console.error(error);
		const response: ApiResponse<null> = { success: false, error: 'Failed to fetch config' };
		return NextResponse.json(response, { status: 500 });
	}
}
