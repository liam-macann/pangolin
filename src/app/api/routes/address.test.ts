import { describe, expect, test } from 'vitest';

import app from '@/api/hono';

describe('GET /api/address/metadata/{country}', () => {
	test('Returns 405 for an unsupported method', async () => {
		const res = await app.request('/api/address/metadata/US', { method: 'POST' });
		expect(res.status).toBe(405);
		expect(res.headers.get('Allow')).toContain('GET');
		expect(res.headers.get('Content-Type')).toContain('application/problem+json');
		await expect(res.json()).resolves.toMatchObject({ status: 405, code: 'method-not-allowed' });
	});

	test('Returns 400 for an unrecognized country code', async () => {
		const res = await app.request('/api/address/metadata/ZZ');
		expect(res.status).toBe(400);
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
