import { Temporal } from 'temporal-polyfill';
import z from 'zod/v4';

import { invoice } from '@/lib/validation/invoice';

const plainDateToISO = (error: string) =>
	z.codec(z.instanceof(Temporal.PlainDate, { error }), z.iso.date({ error }), {
		decode: value => value.toString(),
		encode: value => Temporal.PlainDate.from(value),
	});

export const schema = invoice.extend({
	issuedAt: plainDateToISO('Please enter a valid issue date').optional(),
	dueAt: plainDateToISO('Please enter a due date'),
});

/** Input type for the form {@link schema}. */
export type CreateInvoiceDraft = z.input<typeof schema>;
