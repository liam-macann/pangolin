import { resolver } from 'hono-openapi';
import { z } from 'zod';

import { problems } from '@/api/errors';

import { createApiRouter, defineRoute, problemContract } from './shared';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

function isAllowedAvatarUrl(raw: string): boolean {
	try {
		const url = new URL(raw);
		return (
			url.protocol === 'https:' &&
			(url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))
		);
	} catch {
		return false;
	}
}

const route = defineRoute.protected({
	tags: ['Avatar'],
	operationId: 'getAvatar',
	description: "Return the current user's avatar image.",
	responses: {
		200: {
			content: {
				'image/*': {
					schema: resolver(z.file().max(MAX_BODY_BYTES)),
				},
			},
			description: "Return the current user's avatar image.",
		},
		204: { description: 'The current user does not have an avatar image.' },
		...problemContract({
			502: 'The avatar image could not be retrieved from the upstream provider.',
		}),
	},
});

const app = createApiRouter().get('/', ...route, async c => {
	const session = c.get('session');

	if (!session.user.image) return c.body(null, 204);
	if (!isAllowedAvatarUrl(session.user.image)) throw problems.create('UPSTREAM_UNAVAILABLE');

	const response = await fetch(session.user.image, { redirect: 'error' });
	if (!response.ok) throw problems.create('UPSTREAM_UNAVAILABLE');

	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.startsWith('image/')) throw problems.create('UPSTREAM_UNAVAILABLE');

	if (!response.body) throw problems.create('UPSTREAM_UNAVAILABLE');

	const contentLength = response.headers.get('content-length');
	if (Number(contentLength) > MAX_BODY_BYTES) throw problems.create('UPSTREAM_UNAVAILABLE');

	let totalBytes = 0;
	const transform = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			totalBytes += chunk.byteLength;
			if (totalBytes > MAX_BODY_BYTES) throw problems.create('UPSTREAM_UNAVAILABLE');
			controller.enqueue(chunk);
		},
	});

	c.header('Content-Type', contentType);
	c.header(
		'Cache-Control',
		'private, max-age=86400, stale-while-revalidate=172800, stale-if-error=43200',
	);
	c.header('X-Content-Type-Options', 'nosniff');
	if (contentLength) c.header('Content-Length', contentLength);

	return c.body(response.body.pipeThrough(transform));
});

export default app;
