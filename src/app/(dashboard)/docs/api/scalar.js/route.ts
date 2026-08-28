import { getJsAsset } from '@scalar/server-side-rendering';
import { cacheLife } from 'next/cache';

async function getBundle() {
	// Scalar standalone bundle is immutable per release
	'use cache';
	cacheLife('max');
	return getJsAsset();
}

export async function GET() {
	return new Response(await getBundle(), {
		headers: {
			'content-type': 'text/javascript; charset=utf-8',
			'cache-control': 'public, max-age=31536000, immutable',
		},
	});
}
