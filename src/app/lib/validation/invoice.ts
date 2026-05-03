import { createInsertSchema } from 'drizzle-zod';
import z from 'zod/v4';

import { intlNumber } from '@/lib/zod';
import * as schema from '@/db/schema/data';

const item = createInsertSchema(schema.invoiceItems, {
	label: z => z.min(1, 'Please enter a description'),
	quantity: s =>
		intlNumber(
			z.number().min(0, 'Enter a valid quantity').max(10000, 'Too large'),
			'Enter quantity',
		).pipe(s),
	unitCost: s =>
		intlNumber(
			z.number('Enter a valid cost').min(-1000000, 'Too small').max(1000000, 'Too large'),
			'Enter cost',
		).pipe(s),
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

export const invoice = createInsertSchema(schema.invoices, {
	clientDataId: z.uuid({ error: 'Please select a client' }),
	title: z
		.string()
		.transform(v => v.trim())
		.transform(v => (v === '' ? undefined : v))
		.optional(),
	description: z
		.string()
		.transform(v => v?.trim())
		.transform(v => (v === '' ? undefined : v))
		.optional(),
	issuedAt: z.date({ error: 'Please enter an issue date' }).optional(),
	dueAt: z.date({ error: 'Please enter a due date' }),
})
	.pick({
		clientDataId: true,
		title: true,
		description: true,
		issuedAt: true,
		dueAt: true,
	})
	.extend({
		...createInsertSchema(schema.invoiceStatus, {
			notes: z
				.string()
				.transform(v => v.trim())
				.transform(v => (v === '' ? undefined : v))
				.optional(),
		}).pick({ status: true, notes: true }).shape,

		items: z.array(item).min(1, 'Invoice must contain items'),
	});
