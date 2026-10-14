import 'server-only';

import { hc } from 'hono/client';
import { headers } from 'next/headers';

import app, { type AppType } from '@/api/hono';
import { buildSearchParams } from '@/api/query';

const origin = (inbound: Headers) => {
	const firstValue = (value: string | null) => value?.split(',')[0]?.trim() || undefined;

	const host = firstValue(inbound.get('x-forwarded-host')) ?? firstValue(inbound.get('host'));

	const protocol = firstValue(inbound.get('x-forwarded-proto'));
	const scheme = protocol === 'http' || protocol === 'https' ? protocol : 'https';

	try {
		return new URL(`${scheme}://${host ?? 'localhost'}`);
	} catch {
		return new URL(`${scheme}://localhost`);
	}
};

/** Routes in-process RPC through Hono, preserving caller request context */
const internalFetch: typeof fetch = async (input, init) => {
	const inbound = await headers();
	const request = new Request(input, init);

	const source = new URL(request.url);
	const url = new URL(source.pathname + source.search, origin(inbound));

	const rewritten = new Request(url, request);

	const outbound = new Headers(inbound);
	rewritten.headers.forEach((value, key) => void outbound.set(key, value));

	return app.request(new Request(rewritten, { headers: outbound }));
};

// Placeholder sentinel; internalFetch rewrites the origin per request
export const rpc = hc<AppType>('http://internal/api', { fetch: internalFetch, buildSearchParams });
export default rpc;
