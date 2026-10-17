import { eq, type SQLWrapper, sql } from 'drizzle-orm';
import { type PgTable, type PgView, QueryBuilder } from 'drizzle-orm/pg-core';
import { resolver } from 'hono-openapi';
import { z } from 'zod';

import { Invoice } from '@/api/dto/invoice';
import { problemContract } from '@/api/errors';
import { defineKeyset } from '@/api/pagination';
import { fetchInvoices } from '@/lib/data/invoice';
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

/** A column of a row sharing the invoice ID: its document, status, or totals. */
const related =
	(column: SQLWrapper, from: (PgTable | PgView) & { id: SQLWrapper }) =>
	(invoice: typeof tables.invoices) =>
		sql`${qb
			.select({ value: sql`${column}` })
			.from(from)
			.where(eq(from.id, invoice.id))}`;

/** A column of the client version the invoice is billed to. */
const billed = (column: SQLWrapper) => (invoice: typeof tables.invoices) =>
	sql`${qb
		.select({ value: sql`${column}` })
		.from(tables.documents)
		.innerJoin(tables.clientData, eq(tables.clientData.id, tables.documents.clientDataId))
		.where(eq(tables.documents.id, invoice.id))}`;

/** Fields the invoice list can be sorted by. */
export const keyset = defineKeyset(tables.invoices, {
	issuedAt: [
		invoice => invoice.issuedAt,
		// Creation order approximates allocation order, which is stable across numbering scheme switches
		related(tables.documents.createdAt, tables.documents),
	],
	amount: related(tables.documentsWithSum.grossTotal, tables.documentsWithSum),
	name: billed(tables.clientData.displayName),
	organization: billed(coalesce(tables.clientData.organization, tables.clientData.name)),
});

const query = z
	.object({
		/** @default "-issuedAt" */
		sort: keyset.sortParam.prefault(['-issuedAt']),
		/** Client the invoices are billed to. */
		client: z
			.uuid()
			.optional()
			.meta({
				description: 'Filter invoices by client.',
				examples: ['550e8400-e29b-41d4-a716-446655440000'],
			}),
	})
	.extend(paginationQuerySchema.shape)
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
							meta: paginationMetaSchema,
						}),
					),
				},
			},
			description: 'List invoices, optionally filtered by client.',
			links: {
				NextPage: {
					operationId: 'listInvoices',
					parameters: {
						client: '$request.query.client',
						sort: '$request.query.sort',
						cursor: '$response.body#/meta/nextCursor',
					},
				},
			},
		},
		...problemContract({
			422: {
				description: 'The pagination cursor is invalid.',
				problems: ['INVALID_CURSOR'],
			},
		}),
	},
});

const app = createApiRouter().get('/', ...route, validator('query', query), async c => {
	const { cursor, limit, sort, client } = c.req.valid('query');

	const page = keyset.page({ cursor, limit, sort });

	const rows = await fetchInvoices({
		where: page.where({
			...(client && { document: { clientData: { clientId: { eq: client } } } }),
		}),
		orderBy: page.orderBy,
		extras: page.extras,
		limit: page.limit,
	});

	return c.json(page.result(rows), 200);
});

export default app;
