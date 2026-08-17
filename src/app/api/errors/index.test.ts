import { Hono } from 'hono';
import { forbidden, notFound, unauthorized } from 'next/navigation';
import { describe, expect, test } from 'vitest';

import { onError } from '@/api/errors';

const route = (callback: () => Response) =>
	new Hono().onError(onError).get('/path', () => callback());

describe('onError', () => {
	// Converts Next.js control flow statements
	test.for([
		{ name: 'notFound', callback: notFound, status: 404, code: 'not-found' },
		{ name: 'unauthorized', callback: unauthorized, status: 401, code: 'unauthorized' },
		{ name: 'forbidden', callback: forbidden, status: 403, code: 'forbidden' },
	])('Translates $name into its RFC 9457 problem response', async ({ callback, status, code }) => {
		const res = await route(callback).request('/path');

		expect(res.status).toBe(status);
		await expect(res.json()).resolves.toMatchObject({ status, code });
	});
});
