import { afterEach, describe, expect, test, vi } from 'vitest';

import app from '@/api/hono';

import { asUser, sessionStorage } from '@/test/session';

const GOOGLE_AVATAR_URL = 'https://lh3.googleusercontent.com/a/test-avatar';
const MAX_BODY_BYTES = 5 * 1024 * 1024;

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('GET /api/avatar', () => {
	test('Returns 401 when there is no session', async () => {
		const res = await app.request('/api/avatar');
		expect(res.status).toBe(401);
	});

	asUser('Returns 204 when the user has no image', async ({ session }) => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);

		const withoutImage = { ...session, user: { ...session.user, image: null } };
		const res = await sessionStorage.run(withoutImage, () => app.request('/api/avatar'));

		expect(res.status).toBe(204);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	asUser('Rejects a non-Google image host without fetching it', async ({ session }) => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);

		const withImage = {
			...session,
			user: { ...session.user, image: 'https://evil.example.com/avatar.png' },
		};
		const res = await sessionStorage.run(withImage, () => app.request('/api/avatar'));

		expect(res.status).toBe(502);
		await expect(res.json()).resolves.toMatchObject({ code: 'upstream-unavailable' });
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	asUser('Returns 502 when the upstream request fails', async ({ session }) => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

		const withImage = { ...session, user: { ...session.user, image: GOOGLE_AVATAR_URL } };
		const res = await sessionStorage.run(withImage, () => app.request('/api/avatar'));

		expect(res.status).toBe(502);
	});

	asUser('Returns 502 when the upstream response is not an image', async ({ session }) => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response('not an image', {
					status: 200,
					headers: { 'content-type': 'text/html' },
				}),
			),
		);

		const withImage = { ...session, user: { ...session.user, image: GOOGLE_AVATAR_URL } };
		const res = await sessionStorage.run(withImage, () => app.request('/api/avatar'));

		expect(res.status).toBe(502);
	});

	asUser('Returns 502 when upstream Content-Length exceeds size limits', async ({ session }) => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(null, {
					status: 200,
					headers: {
						'content-type': 'image/png',
						'content-length': String(MAX_BODY_BYTES + 1),
					},
				}),
			),
		);

		const withImage = { ...session, user: { ...session.user, image: GOOGLE_AVATAR_URL } };
		const res = await sessionStorage.run(withImage, () => app.request('/api/avatar'));

		expect(res.status).toBe(502);
	});

	asUser(
		'Rejects an oversized stream even without a Content-Length header',
		async ({ session }) => {
			const chunk = new Uint8Array(3 * 1024 * 1024);
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(chunk);
					controller.enqueue(chunk);
					controller.close();
				},
			});

			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					.mockResolvedValue(
						new Response(stream, { status: 200, headers: { 'content-type': 'image/png' } }),
					),
			);

			const withImage = { ...session, user: { ...session.user, image: GOOGLE_AVATAR_URL } };
			const res = await sessionStorage.run(withImage, () => app.request('/api/avatar'));

			// Headers are already committed by the time the body overflows mid-stream
			expect(res.status).toBe(200);
			await expect(res.arrayBuffer()).rejects.toThrow();
		},
	);

	asUser('Streams the complete image on success', async ({ session }) => {
		const body = new Uint8Array([1, 2, 3, 4]);
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(body, {
					status: 200,
					headers: { 'content-type': 'image/png', 'content-length': String(body.byteLength) },
				}),
			),
		);

		const withImage = { ...session, user: { ...session.user, image: GOOGLE_AVATAR_URL } };
		const res = await sessionStorage.run(withImage, () => app.request('/api/avatar'));

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/png');
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(body);
	});

	asUser('Streams the response before the upstream body finishes', async ({ session }) => {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3, 4]));
				// Deliberately never closes
			},
		});

		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response(stream, { status: 200, headers: { 'content-type': 'image/png' } }),
				),
		);

		const withImage = { ...session, user: { ...session.user, image: GOOGLE_AVATAR_URL } };

		// A middleware that buffers the whole body (e.g. etag hashing it) would hang forever
		const res = await sessionStorage.run(withImage, () => app.request('/api/avatar'));
		expect(res.status).toBe(200);

		// The etag middleware must not run on a streamed response
		expect(res.headers.get('ETag')).toBeNull();

		await res.body?.cancel();
	});
});
