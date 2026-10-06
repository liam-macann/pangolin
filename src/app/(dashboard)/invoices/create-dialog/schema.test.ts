import { Temporal } from 'temporal-polyfill';
import { expect, test } from 'vitest';
import z from 'zod/v4';

import { schema } from './schema';

test('Translates dates between draft and submission values', async () => {
	const draft = Temporal.PlainDate.from('2026-10-06');

	await expect(z.decodeAsync(schema.shape.dueAt, draft)).resolves.toBe('2026-10-06');
	await expect(z.encodeAsync(schema.shape.dueAt, '2026-10-06')).resolves.toEqual(draft);

	await expect(z.decodeAsync(schema.shape.issuedAt, draft)).resolves.toBe('2026-10-06');
	await expect(z.encodeAsync(schema.shape.issuedAt, '2026-10-06')).resolves.toEqual(draft);
});
