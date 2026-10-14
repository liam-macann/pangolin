import { resolver } from 'hono-openapi';
import { z } from 'zod';

import { Client } from '@/api/dto/client';
import { problemContract } from '@/api/errors';
import { countClients, fetchClient, fetchClients } from '@/lib/data/client';

import { createApiRouter, defineRoute, paginationSchema, validator } from './shared';

const listQuery = paginationSchema.omit({ total: true }).strict();
const listRoute = defineRoute.protected({
	tags: ['Clients'],
	operationId: 'listClients',
	description: 'List clients belonging to the current user.',
	responses: {
		200: {
			content: {
				'application/json': {
					schema: resolver(
						z.object({
							data: z.array(Client).max(200),
							meta: paginationSchema,
						}),
					),
				},
			},
			description: 'List the current user’s clients.',
		},
		...problemContract({
			422: {
				description: 'Invalid query parameters.',
				problems: [422],
			},
		}),
	},
});

const getParams = z.object({
	id: z.uuid().meta({
		description: 'Unique identifier of the client.',
		examples: ['f47ac10b-58cc-4372-a567-0e02b2c3d479'],
	}),
});
const getRoute = defineRoute.protected({
	tags: ['Clients'],
	operationId: 'getClient',
	description: 'Return the requested client.',
	responses: {
		200: {
			content: {
				'application/json': { schema: resolver(z.object({ data: Client })) },
			},
			description: 'Return the requested client.',
		},
		...problemContract({
			404: {
				description: 'The requested client was not found.',
				problems: ['NOT_FOUND'],
			},
			422: {
				description: 'The client identifier is invalid.',
				problems: [422],
			},
		}),
	},
});

const app = createApiRouter()
	.get('/', ...listRoute, validator('query', listQuery), async c => {
		const { limit = undefined, offset = undefined } = c.req.valid('query');
		const [data, total] = await Promise.all([fetchClients({ limit, offset }), countClients()]);

		return c.json({ data, meta: { total, limit, offset } }, 200);
	})
	.get('/:id', ...getRoute, validator('param', getParams), async c => {
		const { id } = c.req.valid('param');
		const data = await fetchClient(id);
		return c.json({ data }, 200);
	});

export default app;
