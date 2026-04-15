import { createInsertSchema } from 'drizzle-zod';
import z from 'zod';

import { clientData as clientDataSchema } from '@/db/schema/data';

export const clientData = createInsertSchema(clientDataSchema, {
	email: z.email(),
	name: z.string().min(1, 'Required'),
}).pick({
	clientId: true,
	name: true,
	email: true,
});
