import { describe, expect } from 'vitest';

import { withRLS } from '@/db';

import { asUser as test } from '@/test/session';

import { allocateSequence } from './sequencer';

describe('allocateSequence', () => {
	test('Independent sequence for different partition in a namespace', async ({
		session: {
			user: { id: userId },
		},
	}) => {
		await withRLS(async db => {
			const invA = await allocateSequence(db, { userId, namespace: 'invoice', partition: '2026' });
			const invB = await allocateSequence(db, { userId, namespace: 'invoice', partition: '2026' });
			const invC = await allocateSequence(db, { userId, namespace: 'invoice', partition: null });
			const invD = await allocateSequence(db, { userId, namespace: 'invoice', partition: '2025' });

			expect([invA, invB, invC, invD]).toEqual([1, 2, 1, 1]);
		});
	});
});
