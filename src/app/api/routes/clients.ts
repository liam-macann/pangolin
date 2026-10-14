import { and, eq, isNull, type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import { resolver } from 'hono-openapi';
import { z } from 'zod';

import { Client } from '@/api/dto/client';
import { problemContract } from '@/api/errors';
import { defineKeyset } from '@/api/pagination';
import { fetchClient, fetchClients } from '@/lib/data/client';
import { coalesce } from '@/lib/utils/drizzle';
import * as tables from '@/db/schema';

import {
	createApiRouter,
	defineRoute,
	paginationMetaSchema,
	paginationQuerySchema,
	validator,
} from './shared';

const qb = new QueryBuilder();

/** A `client_data` column read from the currently-valid revision of a logical client. */
const currentRevision =
	(column: SQLWrapper) =>
	(client: typeof tables.clients): SQL<string> =>
		sql`${qb
			.select({ value: sql`${column}` })
			.from(tables.clientData)
			.where(and(eq(tables.clientData.clientId, client.id), isNull(tables.clientData.validTo)))
			.limit(1)}`;

/** Fields the client list can be sorted by. */
const keyset = defineKeyset(tables.clients, {
	name: currentRevision(coalesce(tables.clientData.name, tables.clientData.organization)),
	organization: currentRevision(coalesce(tables.clientData.organization, tables.clientData.name)),
});

const listQuery = z
	.object({ sort: keyset.sortParam.prefault(['organization']) })
	.extend(paginationQuerySchema.shape)
	.strict();

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
							meta: paginationMetaSchema,
						}),
					),
				},
			},
			description: 'List clients for the authenticated user.',
			links: {
				NextPage: {
					operationId: 'listClients',
					parameters: {
						sort: '$request.query.sort',
						cursor: '$response.body#/meta/nextCursor',
					},
				},
			},
		},
		...problemContract({
			422: {
				description: 'Query parameters (including pagination cursor) are invalid.',
				problems: ['INVALID_CURSOR', 422],
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
		const { cursor, limit, sort } = c.req.valid('query');

		const page = keyset.page({ cursor, limit, sort });

		const rows = await fetchClients({
			where: page.where({}),
			orderBy: page.orderBy,
			extras: page.extras,
			limit: page.limit,
		});

		return c.json(page.result(rows), 200);
	})
	.get('/:id', ...getRoute, validator('param', getParams), async c => {
		const { id } = c.req.valid('param');
		const data = await fetchClient(id);
		return c.json({ data }, 200);
	});

export default app;
