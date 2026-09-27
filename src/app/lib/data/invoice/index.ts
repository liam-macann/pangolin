import { and, asc, count, eq, min, sql, sum } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { notFound, unstable_rethrow } from 'next/navigation';

import { type Config } from '@/api/dto/config';
import { type Invoice } from '@/api/dto/invoice';
import { fetchConfig } from '@/lib/data';
import { type ClientData } from '@/lib/data/client';
import { type FetchOptions, query } from '@/lib/data/helpers';
import { withVault } from '@/lib/encrypt';
import { invoiceReference, type Simplify } from '@/lib/utils';
import { coalesce, mergeOrderBy, withFilter } from '@/lib/utils/drizzle';
import { type NumericString } from '@/lib/utils/numeric';
import { withRLS } from '@/db';
import { type relations } from '@/db/relations';
import * as schema from '@/db/schema';

import { type Session } from '@/auth';
/** A billed line item, joined with the tax rows applied to it */
export type LineItem = Simplify<
	Omit<
		typeof schema.itemsWithTax.$inferSelect,
		'id' | 'documentId' | 'userId' | 'configId' | 'taxRegistration' | 'order'
	> & {
		taxes: Pick<typeof schema.taxes.$inferSelect, 'name' | 'rate'>[];
	}
>;

/** Superset of {@link Invoice} with relational data */
export type DetailedInvoice = Omit<Invoice, 'clientData' | 'config'> & {
	clientData: Pick<ClientData, 'name' | 'organization' | 'address'>;
	config: Config;
	items: LineItem[];

	/** Tax contribution across all items, collapsed by tax name */
	tax: { name: string; contribution: NumericString }[];
};

/** Fetch a bounded window of invoices for the authenticated user. */
export const fetchInvoices = (opts: Parameters<typeof _fetchInvoices>[1]) =>
	query(async session => _fetchInvoices(session, opts), 'Failed to fetch invoices');

async function _fetchInvoices(
	session: Session,
	opts: FetchOptions<typeof relations.invoices>,
): Promise<Invoice[]> {
	'use cache';
	cacheLife('hours');
	cacheTag(`invoices-${session.user.id}`);

	return withRLS(session, async tx =>
		tx.query.invoices
			.findMany({
				where: {
					...(opts.where ?? {}),
					userId: { eq: session.user.id },
				},
				columns: { userId: false },
				with: {
					status: { columns: { id: false, userId: false } },
					documentWithSum: {
						columns: {
							id: false,
							clientDataId: false,
							configId: false,
							userId: false,

							// Included with config data
							taxRegistration: false,
							currency: false,
						},
						with: {
							clientData: { columns: { name: true, organization: true, clientId: true } },
							config: {
								columns: {
									timezone: true,
									currency: true,
									numberingScheme: true,
								},
							},
						},
					},
				},
				orderBy: mergeOrderBy(opts.orderBy, { issuedAt: 'desc', id: 'desc' }),
				limit: opts.limit,
				offset: opts.offset,
			})
			.then(res =>
				res.map(({ documentWithSum, ...inv }) => ({
					...documentWithSum,
					...inv,
					createdAt: documentWithSum.createdAt.toISOString(),
					reference: invoiceReference(inv, documentWithSum.config.numberingScheme),
				})),
			),
	);
}

/** Fetches invoices for a given client. Accepts logical client ID, not SCD ID. */
export const fetchInvoicesForClient = (clientId: string, limit: number) =>
	fetchInvoices({
		where: { documentWithSum: { clientData: { client: { id: { eq: clientId } } } } },
		limit,
	});

/** Count invoices for the authenticated user, optionally filtered by client */
export const countInvoices = (clientId?: string) =>
	query(session => _countInvoices(session, clientId), 'Failed to count invoices');

async function _countInvoices(session: Session, clientId?: string) {
	'use cache';
	cacheLife('hours');
	cacheTag(`invoices-${session.user.id}`);

	return withRLS(session, async tx => {
		const [row] = await tx
			.select({ count: count() })
			.from(schema.invoices)
			.innerJoin(schema.documents, eq(schema.documents.id, schema.invoices.id))
			.innerJoin(schema.clientData, eq(schema.clientData.id, schema.documents.clientDataId))
			.where(
				and(
					eq(schema.invoices.userId, session.user.id),
					clientId ? eq(schema.clientData.clientId, clientId) : undefined,
				),
			);

		return row?.count ?? 0;
	});
}

/** Join relational (incl. item) details with a single invoice record for authenticated user */
export async function fetchInvoice(id: string): Promise<DetailedInvoice> {
	try {
		return await withRLS(async (db, session) => {
			// Get all active taxes, and calculate sum for display in the invoice subtotals
			// Executed as CTE to collapse tax rows that share the same name (eg. GST(10%) and GST(5%) would share one sum)
			const taxContribution = db.$with('tax_calc').as(
				db
					.select({
						contribution:
							sql`${withFilter(sum(schema.lineItems.netAmount), eq(schema.itemTaxes.taxId, schema.taxes.id))} * ${schema.taxes.rate} * ${schema.config.taxRegistration}::int`
								.mapWith(schema.lineItems.netAmount)
								.as('contribution'),

						taxId: schema.taxes.id,
						configId: schema.config.id,
						order: schema.configTaxes.order,
						name: schema.taxes.name,
						rate: schema.taxes.rate,
					})
					.from(schema.invoices)
					.where(eq(schema.invoices.id, id))
					.innerJoin(schema.documents, eq(schema.documents.id, schema.invoices.id))
					.innerJoin(schema.config, eq(schema.documents.configId, schema.config.id))
					.innerJoin(schema.configTaxes, eq(schema.configTaxes.configId, schema.config.id))
					.innerJoin(schema.taxes, eq(schema.taxes.id, schema.configTaxes.taxId))
					.leftJoin(schema.lineItems, eq(schema.lineItems.documentId, schema.invoices.id))
					.leftJoin(schema.itemTaxes, eq(schema.itemTaxes.itemId, schema.lineItems.id))
					.groupBy(schema.config.id, schema.taxes.id, schema.configTaxes.order)
					.orderBy(schema.configTaxes.order),
			);

			const res = await db.query.invoices.findFirst({
				where: { userId: { eq: session.user.id }, id: { eq: id } },
				columns: { userId: false },
				with: {
					status: { columns: { id: false, userId: false } },
					documentWithSum: {
						columns: {
							id: false,
							clientDataId: false,
							userId: false,

							// Included with config data
							taxRegistration: false,
							currency: false,
						},
						with: {
							clientData: {
								columns: { name: true, organization: true },
								with: { address: true },
							},
							items: {
								columns: {
									id: false,
									documentId: false,
									userId: false,
									configId: false,
									taxRegistration: false,
									order: false,
								},
								with: { taxes: { columns: { name: true, rate: true } } },
								orderBy: { order: 'asc' },
							},
						},
					},
				},
			});

			// Collapse tax rows that share the same name
			const tax = await db
				.with(taxContribution)
				.select({
					name: taxContribution.name,
					contribution: coalesce(sum(taxContribution.contribution), 0).mapWith(
						schema.lineItems.netAmount,
					),
				})
				.from(taxContribution)
				.groupBy(taxContribution.name)
				.orderBy(asc(min(taxContribution.order)));

			if (!res) notFound();

			const {
				documentWithSum: { configId, ...document },
				...invoice
			} = res;

			return withVault(async (vault): Promise<DetailedInvoice> => {
				const config = await fetchConfig(configId);

				return {
					...document,
					...invoice,
					createdAt: document.createdAt.toISOString(),
					reference: invoiceReference(invoice, config.numberingScheme),
					config,
					clientData: await vault.decryptDeep(document.clientData),
					tax,
				};
			});
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoice');
	}
}
