import 'client-only';

import { hc } from 'hono/client';

import { type AppType } from '@/api/hono';

const queryFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

export const rpc = hc<AppType>('/api', { fetch: queryFetch });
export default rpc;
