import { describe, expect, test } from 'vitest';

import app from '@/api/hono';

describe('GET /api/address/metadata/{country}', () => {
	test('Returns 405 for an unsupported method', async () => {
		const res = await app.request('/api/address/metadata/US', { method: 'POST' });
		expect(res.status).toBe(405);
		expect(res.headers.get('Allow')).toBe('GET, HEAD');
	});

	test('Returns 422 for an unrecognized country code', async () => {
		const res = await app.request('/api/address/metadata/ZZ');
		expect(res.status).toBe(422);
	});

	test('Returns address metadata for a valid country, with a long-lived cache header', async () => {
		const res = await app.request('/api/address/metadata/US');
		expect(res.status).toBe(200);

		expect(res.headers.get('Cache-Control')).toContain('public');
		expect(res.headers.get('Cache-Control')).toContain('max-age=');

		const body = await res.json();
		expect(body.data.key).toBe('US');
	});
});
