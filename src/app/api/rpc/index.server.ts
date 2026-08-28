import 'server-only';

import { hc } from 'hono/client';
import { headers } from 'next/headers';

import app, { type AppType } from '@/api/hono';

const internalFetch: typeof fetch = async (input, init) => {
	const outgoing = new Request(input, init);
	const requestHeaders = new Headers(await headers());
	outgoing.headers.forEach((value, key) => void requestHeaders.set(key, value));
	return app.request(new Request(outgoing, { headers: requestHeaders }));
};

export const rpc = hc<AppType>('http://hono.internal/api', { fetch: internalFetch });
export default rpc;
