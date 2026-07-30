import { createInsertSchema } from 'drizzle-zod';
import z from 'zod/v4';

import { intlNumber } from '@/lib/zod';
import * as schema from '@/db/schema/data';

const item = createInsertSchema(schema.lineItems, {
	label: z => z.trim().min(1, 'Please enter a description'),
	note: z
		.string()
		.transform(v => v.trim())
		.transform(v => (v === '' ? undefined : v))
		.optional(),
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

export const document = createInsertSchema(schema.documents, {
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

export const invoice = document.extend({
	...createInsertSchema(schema.invoices, {
		issuedAt: z.date({ error: 'Please enter an issue date' }).optional(),
		dueAt: z.date({ error: 'Please enter a due date' }),
	}).pick({ issuedAt: true, dueAt: true }).shape,

	...createInsertSchema(schema.invoiceStatus, {
		notes: z
			.string()
			.transform(v => v.trim())
			.transform(v => (v === '' ? undefined : v))
			.optional(),
	}).pick({ status: true, notes: true }).shape,
});
