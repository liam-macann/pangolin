import { asc, eq, inArray, min, sql, sum } from 'drizzle-orm';
import { notFound, unstable_rethrow } from 'next/navigation';
import { Temporal } from 'temporal-polyfill';

import { type Config } from '@/api/dto/config';
import { type Invoice } from '@/api/dto/invoice';
import { fetchConfig } from '@/lib/data';
import { type ClientData } from '@/lib/data/client';
import { type FetchOptions } from '@/lib/data/helpers';
import { withVault } from '@/lib/encrypt';
import { invoiceReference, type Simplify } from '@/lib/utils';
import { coalesce, withFilter } from '@/lib/utils/drizzle';
import { type NumericString } from '@/lib/utils/numeric';
import { withRLS } from '@/db';
import { type relations } from '@/db/relations';
import * as schema from '@/db/schema';

/** Serializes a stored instant to the millisecond-precision UTC form of the API contract */
const toISOString = (instant: Temporal.InstantLike) =>
	Temporal.Instant.from(instant).toString({ fractionalSecondDigits: 3 });

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
export async function fetchInvoices(
	opts: FetchOptions<typeof relations.invoices>,
): Promise<Invoice[]> {
	try {
		return await withRLS(async (tx, session) => {
			// Caller order replaces the default, and so must end on a unique key
			const orderBy = opts.orderBy ?? { issuedAt: 'desc', id: 'desc' };

			// Picks which invoices match the filter first, embedded as a subquery
			// Relations would otherwise be joined for every row before it is sorted and limited
			const window = tx.query.invoices.findMany({
				where: { ...(opts.where ?? {}), userId: { eq: session.user.id } },
				columns: { id: true },
				orderBy,
				limit: opts.limit,
			});

			const rows = await tx.query.invoices.findMany({
				where: { RAW: invoice => inArray(invoice.id, window) },
				orderBy, // The window order is lost by the lookup, so is applied again
				columns: { userId: false },
				extras: opts.extras,
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
							config: { columns: { timezone: true, currency: true, numberingScheme: true } },
						},
					},
				},
			});

			return rows.map(({ documentWithSum, status, ...inv }) => ({
				...documentWithSum,
				...status,
				...inv,
				createdAt: toISOString(documentWithSum.createdAt),
				reference: invoiceReference(inv, documentWithSum.config.numberingScheme),
			}));
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices');
	}
}

/** Fetches invoices for a given client. Accepts logical client ID, not a client version ID. */
export const fetchInvoicesForClient = (clientId: string, limit: number) =>
	fetchInvoices({
		where: { document: { clientData: { clientId: { eq: clientId } } } },
		limit,
	});

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
				status,
				...invoice
			} = res;

			return withVault(async (vault): Promise<DetailedInvoice> => {
				const config = await fetchConfig(configId);

				return {
					...document,
					...status,
					...invoice,
					createdAt: toISOString(document.createdAt),
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
