import { createInsertSchema } from 'drizzle-orm/zod';
import z from 'zod';

import { schema as addressSchema } from '@/lib/validation/address';
import { clientData as clientDataSchema } from '@/db/schema/data';

/** Field-level schema for client data, excluding generated fields.
 *  Carries no cross-field refinements, so subsets may be derived with pick()/omit()/extend(). */
export const clientDataFields = createInsertSchema(clientDataSchema, {
	email: s => z.string().trim().pipe(z.email()).pipe(s),
	name: () =>
		z
			.string()
			.trim()
			.transform(value => value || null),
	organization: () =>
		z
			.string()
			.trim()
			.transform(value => value || null),
})
	.pick({
		clientId: true,
		name: true,
		email: true,
		organization: true,
	})
	.extend({
		address: addressSchema.nullable(),
	});

const refinement = <T extends z.ZodObject>(fields: T) =>
	fields.refine(c => c?.name || c?.organization, {
		message: 'Name or organisation must be present',
		path: ['name'],
	});

/** Complete insertion record for client data, excluding generated fields */
export const clientData = refinement(clientDataFields);

/** Insertion record for a brand new client, whose logical client id is assigned server-side */
export const clientDataCreate = refinement(clientDataFields.omit({ clientId: true }));
