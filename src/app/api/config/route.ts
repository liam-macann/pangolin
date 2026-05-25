import { unstable_rethrow } from 'next/navigation';
import { NextResponse } from 'next/server';

import { getUserConfig } from '@/lib/data';

import { type ApiResponse, type RouteResponse } from '..';

export type Data = Awaited<ReturnType<typeof getUserConfig>>;

export async function GET(): RouteResponse<Data> {
	try {
		const data = await getUserConfig();

		const response: ApiResponse<Data> = { success: true, data };
		return NextResponse.json(response);
	} catch (error) {
		unstable_rethrow(error);

		console.error(error);
		const response: ApiResponse<null> = { success: false, error: 'Failed to fetch config' };
		return NextResponse.json(response, { status: 500 });
	}
}
