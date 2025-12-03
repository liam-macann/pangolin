import { headers } from 'next/headers';
import { getSession } from '@/auth';

export async function GET() {
	const session = await getSession({ headers: await headers() });
	if (!session) throw new Error('Request not authenticated');

	if (!session.user.image) {
		return new Response(JSON.stringify({ error: 'Missing image URL' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const response = await fetch(session.user.image);

		if (!response.ok) {
			return new Response(null, { status: response.status });
		}

		const buffer = await response.arrayBuffer();

		return new Response(buffer, {
			headers: {
				'Content-Type': response.headers.get('content-type') || 'image/jpeg',
				'Cache-Control': 'public, max-age=86400, stale-while-revalidate=172800', // 1 day
			},
		});
	} catch (err) {
		console.error(err);
		return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}
