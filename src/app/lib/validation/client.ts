import { createInsertSchema } from 'drizzle-zod';
import z from 'zod';

import { schema as addressSchema } from '@/lib/validation/address';
import { clientData as clientDataSchema } from '@/db/schema/data';

export const clientData = createInsertSchema(clientDataSchema, {
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
	})
	.refine(c => c.name || c.organization, {
		message: 'Name or organisation must be present',
		path: ['name'],
	});
