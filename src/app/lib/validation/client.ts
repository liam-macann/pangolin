import { createInsertSchema } from 'drizzle-zod';
import z from 'zod';

import { schema as addressSchema } from '@/lib/validation/address';
import { clientData as clientDataSchema } from '@/db/schema/data';

export const clientData = createInsertSchema(clientDataSchema, {
	email: z.email(),
	name: z.string().min(1, 'Required'),
})
	.pick({
		clientId: true,
		name: true,
		email: true,
	})
	.extend({
		address: addressSchema.nullable(),
	});
