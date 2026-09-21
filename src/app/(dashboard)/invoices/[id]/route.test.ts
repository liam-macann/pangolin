import { randomUUID } from 'node:crypto';
import * as navigation from 'next/navigation';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { insertTestInvoice, setUpConfigAndClient } from '@/lib/actions/tests/fixtures';
import * as invoiceData from '@/lib/data/invoice';

import { asUser, createTestSession, sessionStorage } from '@/test/session';

import { GET } from './route';

vi.mock(import('@/lib/data/invoice'), async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, fetchInvoice: vi.fn(actual.fetchInvoice) };
});

const request = (id: string) => new NextRequest(`http://localhost/invoices/${id}`);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

afterEach(() => vi.restoreAllMocks());

describe('GET /invoices/[id]', () => {
	test('Rejects a malformed invoice id with 400', async () => {
		// Rejects regardless of authentication status
		const response = await GET(request('not-a-uuid'), ctx('not-a-uuid'));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Invalid invoice id' });
	});

	test('Throws unauthorized() without a session', async () => {
		const id = randomUUID();

		await expect(GET(request(id), ctx(id))).rejects.toThrow();
		expect(navigation.unauthorized).toHaveBeenCalled();
	});

	asUser('Propagates notFound() as a 404 for a nonexistent invoice', async () => {
		const id = randomUUID();

		await expect(GET(request(id), ctx(id))).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();
	});

	// We use notFound() rather than forbidden() to avoid leaking resource existence
	asUser('Propagates notFound() for an invoice belonging to another user', async ({ db, auth }) => {
		const otherSession = await createTestSession(db, auth);
		const { client } = await setUpConfigAndClient();
		const id = await insertTestInvoice({
			clientDataId: client.data.scdId,
			items: [{ quantity: 1, unitCost: 100 }],
		});

		await expect(
			sessionStorage.run(otherSession, () => GET(request(id), ctx(id))),
		).rejects.toThrow();
		expect(navigation.notFound).toHaveBeenCalled();
	});

	asUser(
		'Returns 500 without leaking error details when PDF generation fails unexpectedly',
		async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.mocked(invoiceData.fetchInvoice).mockRejectedValueOnce(new Error('FLAG'));

			const id = randomUUID();
			const response = await GET(request(id), ctx(id));

			expect(response.status).toBe(500);
			await expect(response.json()).resolves.toEqual({ error: 'Failed to generate invoice' });
		},
	);

	asUser('Returns the invoice as a PDF with hardened response headers', async () => {
		const { client } = await setUpConfigAndClient();
		const id = await insertTestInvoice({
			clientDataId: client.data.scdId,
			items: [{ quantity: 1, unitCost: 100 }],
		});

		const response = await GET(request(id), ctx(id));

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/pdf');
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');

		const bytes = new Uint8Array(await response.arrayBuffer());
		expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-');
	});
});
