import { resolver } from 'hono-openapi';
import { z } from 'zod';

import { Invoice } from '@/api/dto/invoice';
import { problemContract } from '@/api/errors';
import { countInvoices, fetchInvoices } from '@/lib/data/invoice';

import { createApiRouter, defineRoute, paginationSchema, validator } from './shared';

const query = z
	.object({
		client: z
			.uuid()
			.optional()
			.meta({
				description: 'Filter invoices by client.',
				examples: ['550e8400-e29b-41d4-a716-446655440000'],
			}),
	})
	.extend(paginationSchema.omit({ total: true }).shape)
	.strict();

const route = defineRoute.protected({
	tags: ['Invoices'],
	operationId: 'listInvoices',
	description: 'List invoices, optionally filtered by client.',
	responses: {
		200: {
			content: {
				'application/json': {
					schema: resolver(
						z.object({
							data: z.array(Invoice).max(200),
							meta: paginationSchema,
						}),
					),
				},
			},
			description: 'List invoices, optionally filtered by client.',
		},
		...problemContract({
			422: {
				description: 'Invalid query parameters.',
				problems: [422],
			},
		}),
	},
});

const app = createApiRouter().get('/', ...route, validator('query', query), async c => {
	const { client, limit = undefined, offset = undefined } = c.req.valid('query');
	const filter = client ? { document: { clientData: { clientId: { eq: client } } } } : undefined;

	const [data, total] = await Promise.all([
		fetchInvoices({ where: filter, limit, offset }),
		countInvoices(client),
	]);

	return c.json({ data, meta: { total, limit, offset } }, 200);
});

export default app;
