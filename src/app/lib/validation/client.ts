import { createInsertSchema } from 'drizzle-zod';
import z from 'zod';

import { schema as addressSchema } from '@/lib/validation/address';
import { clientData as clientDataSchema } from '@/db/schema/data';

/** Field-level schema for client data, excluding generated fields.
 *  Carries no cross-field refinements, so subsets may be derived with pick()/omit()/extend(). */
export const clientDataFields = createInsertSchema(clientDataSchema, {
	email: z.email(),
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

/** Complete insertion record for client data, excluding generated fields */
export const clientData = clientDataFields.refine(c => c.name || c.organization, {
	message: 'Name or organisation must be present',
	path: ['name'],
});
