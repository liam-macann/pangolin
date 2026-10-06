import { createInsertSchema } from 'drizzle-orm/zod';
import z from 'zod/v4';

import * as schema from '@/db/schema/data';

import { document } from './document';

export const invoice = document.extend({
	...createInsertSchema(schema.invoices, {
		issuedAt: z.iso.date({ error: 'Please enter an issue date' }).optional(),
		dueAt: z.iso.date({ error: 'Please enter a due date' }),
	}).pick({ issuedAt: true, dueAt: true }).shape,

	...createInsertSchema(schema.invoiceStatus, {
		notes: z
			.string()
			.trim()
			.max(1000, 'Too long')
			.transform(v => (v === '' ? undefined : v))
			.optional(),
	}).pick({ status: true, notes: true }).shape,
});
