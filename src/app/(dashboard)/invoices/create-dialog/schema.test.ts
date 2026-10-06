import { Temporal } from 'temporal-polyfill';
import { assert, describe, expect, onTestFinished, test, vi } from 'vitest';
import z from 'zod/v4';

import { createSchema, schema } from './schema';

describe('dueAt', () => {
	const invoiceDraft = (dueAt: string) => ({
		clientDataId: crypto.randomUUID(),
		status: 'unpaid',
		dueAt: Temporal.PlainDate.from(dueAt),
		items: [
			{
				label: 'Consulting services',
				quantity: 1,
				unitCost: 100,
				taxes: new Set<string>(),
			},
		],
	});

	test('Translates dates between draft and submission values', async () => {
		const draft = Temporal.PlainDate.from('2026-10-06');

		await expect(z.decodeAsync(schema.shape.dueAt, draft)).resolves.toBe('2026-10-06');
		await expect(z.encodeAsync(schema.shape.dueAt, '2026-10-06')).resolves.toEqual(draft);
	});

	test.for([
		['in the past', '2026-10-06'],
		['of today', Temporal.Now.plainDateISO('Australia/Sydney').toString()],
	])('Rejects a due date %s', async ([_, dueAt]) => {
		const formSchema = createSchema('Australia/Sydney');

		const result = await formSchema.safeParseAsync(invoiceDraft(dueAt));

		assert(!result.success, 'The due date should fail validation');
		expect(z.flattenError(result.error).fieldErrors.dueAt).toEqual([
			'Due date must be after today',
		]);
	});

	test('Accepts a future due date', async () => {
		const formSchema = createSchema('Australia/Sydney');
		const today = vi
			.spyOn(Temporal.Now, 'plainDateISO')
			.mockReturnValue(Temporal.PlainDate.from('2026-10-07'));
		onTestFinished(() => today.mockRestore());

		await expect(formSchema.parseAsync(invoiceDraft('2026-10-08'))).resolves.toBeDefined();
		expect(today).toHaveBeenCalledWith('Australia/Sydney');
	});
});
