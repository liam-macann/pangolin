import { countries } from 'countries-list';
import { type CountryCode } from 'lib-address';
import { type NextRequest, NextResponse } from 'next/server';

import { type ApiResponse, type RouteResponse } from '@/api';
import { type AddressData, fetchAddressMetadata } from '@/lib/utils/address';

export type Data = AddressData;

export async function generateStaticParams() {
	// Pre-fetch at build (other regions will be fetched and cached on-demand)
	return Object.keys(countries).map(country => ({ country }));
}

// Route does not handle region language variants (eg. `CA--fr`)
export async function GET(
	_request: NextRequest,
	ctx: RouteContext<'/api/address-metadata/[country]'>,
): RouteResponse<Data> {
	try {
		const { country } = await ctx.params;

		const response: ApiResponse<Data> = {
			success: true,
			data: await fetchAddressMetadata(country as CountryCode),
		};

		return NextResponse.json(response, {
			headers: {
				'Cache-Control': `public, max-age=${86400 * 2}, stale-while-revalidate=${86400 * 7}`,
			},
		});
	} catch (error) {
		console.error(error);

		const response: ApiResponse<null> = {
			success: false,
			error: 'Failed to fetch address metadata',
		};
		return NextResponse.json(response, { status: 500 });
	}
}
