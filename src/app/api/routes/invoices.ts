import { resolver, validator } from 'hono-openapi';
import { z } from 'zod';

import { Invoice } from '@/api/dto/invoice';
import { countInvoices, fetchInvoices } from '@/lib/data/invoice';

import {
	createApiRouter,
	defineRoute,
	paginationSchema,
	problemContract,
	validationHook,
} from './shared';

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
		...problemContract({ 422: 'Invalid query parameters.' }),
	},
});

const app = createApiRouter().get(
	'/',
	...route,
	validator('query', query, validationHook),
	async c => {
		const { client, limit = undefined, offset = undefined } = c.req.valid('query');
		const filter = client
			? { documentWithSum: { clientData: { client: { id: { eq: client } } } } }
			: undefined;

		const [data, total] = await Promise.all([
			fetchInvoices({ where: filter, limit, offset }),
			countInvoices(client),
		]);

		return c.json({ data, meta: { total, limit, offset } }, 200);
	},
);

export default app;
