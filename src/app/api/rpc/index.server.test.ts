import { headers } from 'next/headers';
import { expect, test, vi } from 'vitest';

import { asUser } from '@/test/session';

import { rpc } from './index.server';

vi.mock('next/headers', () => ({
	headers: vi.fn(
		async () =>
			new Headers({
				'accept-encoding': 'gzip',
				host: 'dashboard.example',
				'x-forwarded-proto': 'http',
			}),
	),
}));

test('Rejects an unauthenticated in-memory RPC request', async () => {
	const res = await rpc.config.$get();

	expect(res.status).toBe(401);
	await expect(res.json()).resolves.toMatchObject({ status: 401 });
});

asUser('Executes an authenticated in-memory RPC request', async ({ seed }) => {
	const [config] = await seed.config({ versions: 1 });

	const res = await rpc.config.$get();
	expect(res.ok).toBe(true);

	await expect(res.json()).resolves.toMatchObject({ data: { id: config.id } });
});

test('Handlers see the real external origin, not the placeholder RPC base', async () => {
	const res = await rpc.index.$get();
	const { documentation } = await res.json();

	expect(new URL(documentation).origin).toBe('http://dashboard.example');
});

test('Uses the first forwarded origin when proxies append header values', async () => {
	vi.mocked(headers).mockResolvedValueOnce(
		new Headers({
			host: 'internal.example',
			'x-forwarded-host': 'dashboard.example, edge.example',
			'x-forwarded-proto': 'http, https',
		}),
	);

	const res = await rpc.index.$get();
	const { documentation } = await res.json();

	expect(new URL(documentation).origin).toBe('http://dashboard.example');
});
