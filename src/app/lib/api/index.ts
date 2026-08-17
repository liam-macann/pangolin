import { hc } from 'hono/client';

import { type AppType } from '@/api/hono';

export const client = hc<AppType>('/api');
