import { expect, test, vi } from 'vitest';

import { insertTestConfig } from '@/lib/actions/tests/helpers';
import { parseAPIRes } from '@/lib/api/parse-api-response';

import { asUser } from '@/test/session';

import { rpc } from './index.server';

vi.mock('next/headers', () => ({
	headers: vi.fn(async () => new Headers({ 'accept-encoding': 'gzip', cookie: 'session=test' })),
}));

test('Rejects an unauthenticated in-memory RPC request', async () => {
	await expect(parseAPIRes(rpc.config.$get())).rejects.toMatchObject({ status: 401 });
});

asUser('Executes an authenticated in-memory RPC request', async () => {
	await insertTestConfig({ tradingName: 'Acme Holdings' });

	await expect(parseAPIRes(rpc.config.$get())).resolves.toMatchObject({
		data: { tradingName: 'Acme Holdings' },
	});
});
