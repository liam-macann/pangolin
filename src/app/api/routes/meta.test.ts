import { describe, expect, test } from 'vitest';

import app from '@/api/hono';

describe('GET /api', () => {
	test('Returns basic API information without requiring a session', async () => {
		const res = await app.request('/api');
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body).toMatchObject({
			name: 'Invoicer API',
			documentation: expect.stringContaining('/docs/api'),
		});
	});
});

describe('GET /api/health', () => {
	test('Returns a passing health check without requiring a session', async () => {
		const res = await app.request('/api/health');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('application/health+json');
		expect(res.headers.get('cache-control')).toBe('no-cache, no-store, must-revalidate');

		const body = await res.json();
		expect(body).toEqual({ status: 'pass' });
	});
});
