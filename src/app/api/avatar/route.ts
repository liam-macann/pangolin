import { unauthorized, unstable_rethrow } from 'next/navigation';
import { NextResponse } from 'next/server';

import { getSession } from '@/auth';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

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

export async function GET() {
	const session = await getSession();
	if (!session) unauthorized();

	if (!session.user.image) return new NextResponse(null, { status: 204 });

	try {
		if (!isAllowedAvatarUrl(session.user.image)) {
			return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
		}

		// SSRF mitigation
		const response = await fetch(session.user.image, { redirect: 'error' });
		if (!response.ok) return new NextResponse(null, { status: response.status });

		const contentType = response.headers.get('content-type') ?? '';

		// If the fetch does not return an image
		if (!contentType.startsWith('image/')) {
			return NextResponse.json({ error: 'Unexpected content type' }, { status: 502 });
		}

		if (!response.body)
			return NextResponse.json({ error: 'Response has no body' }, { status: 500 });

		// If the fetch claims the response is too large
		const contentLength = response.headers.get('content-length');
		if (Number(contentLength) > MAX_BODY_BYTES) {
			return NextResponse.json({ error: 'Image too large' }, { status: 502 });
		}

		let totalBytes = 0;

		const transform = new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				totalBytes += chunk.byteLength;
				if (totalBytes > MAX_BODY_BYTES) {
					controller.error(new Error('Image too large'));
					response.body?.cancel();
					return;
				}
				controller.enqueue(chunk);
			},
		});

		return new NextResponse(response.body.pipeThrough(transform), {
			headers: {
				'Content-Type': contentType,
				'Cache-Control':
					'private, max-age=86400, stale-while-revalidate=172800, stale-if-error=43200',
				'X-Content-Type-Options': 'nosniff',
				...(contentLength ? { 'Content-Length': contentLength } : {}),
			},
		});
	} catch (err) {
		unstable_rethrow(err);
		console.error(err);
		return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
	}
}
