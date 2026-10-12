import { createInsertSchema } from 'drizzle-orm/zod';
import z from 'zod/v4';

import { NumericString } from '@/lib/utils/numeric';
import { intlNumber } from '@/lib/zod';
import * as schema from '@/db/schema/data';

export const item = createInsertSchema(schema.lineItems, {
	label: z => z.trim().min(1, 'Please enter a description').max(255, 'Too long'),
	note: z
		.string()
		.trim()
		.max(255, 'Too long')
		.transform(v => (v === '' ? undefined : v))
		.optional(),
	quantity: s =>
		intlNumber(
			z
				.number()
				.multipleOf(0.01, 'Too many decimals')
				.min(0, 'Enter a valid quantity')
				.max(10000, 'Too large'),
			'Enter quantity',
		)
			.transform(value => value.toFixed(2))
			.pipe(s)
			.pipe(NumericString),
	unitCost: s =>
		intlNumber(
			z
				.number('Enter a valid cost')
				.multipleOf(0.0001, 'Too many decimals')
				.min(-1000000, 'Too small')
				.max(1000000, 'Too large'),
			'Enter cost',
		)
			.transform(value => value.toFixed(4))
			.pipe(s)
			.pipe(NumericString),
})
	.pick({
		label: true,
		note: true,
		quantity: true,
		unit: true,
		unitCost: true,
	})
	.extend({
		taxes: z.set(z.uuid('Invalid tax: check configuration')),
	});

export const document = createInsertSchema(schema.documents, {
	clientDataId: z.uuid({ error: 'Please select a client' }),
	title: s =>
		z
			.string()
			.max(100, 'Too long')
			.transform(v => v.trim())
			.optional()
			.transform(v => (v === '' ? undefined : (v ?? undefined)))
			.pipe(s.optional()),
	description: z
		.string()
		.trim()
		.max(1000, 'Too long')
		.transform(v => (v === '' ? undefined : v))
		.optional(),
})
	.pick({
		clientDataId: true,
		title: true,
		description: true,
	})
	.extend({
		items: z
			.array(item)
			.min(1, 'Invoice must contain items')
			.max(256, 'No more than 256 items allowed'),
	});
