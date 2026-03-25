import { type RelationsFilter } from 'drizzle-orm';

import { invoiceReference } from '@/lib/utils';
import { db } from '@/db';
import { type relations } from '@/db/relations';

import { getSession } from '@/auth';

/** Fetch all invoices for authenticated user, including basic relational data */

export async function fetchInvoices(
	filter?: RelationsFilter<typeof relations.invoicesWithSum, typeof relations>,
	limit?: number,
) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	try {
		// Get current config to format historical invoices
		return await db.query.invoicesWithSum
			.findMany({
				where: {
					...filter,
					userId: { eq: session.user.id },
				},
				columns: {
					clientDataId: false,
					configId: false,
					userId: false,
				},
				with: {
					clientData: true,
					config: {
						columns: {
							validFrom: false,
							validTo: false,
							id: false,
							userId: false,
							paymentDetails: false,
						},
					},
				},
				orderBy: { index: 'desc' },
				limit,
			})
			.then(res =>
				res.map(inv => ({
					...inv,
					reference: invoiceReference(inv, inv.config.numberingScheme),
				})),
			);
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoices');
	}
}

/** Fetch all invoices for a given client. Accepts logical client ID, not SCD ID. */
export const fetchInvoicesForClient = (clientId: string, limit?: number) =>
	fetchInvoices({ clientData: { client: { id: { eq: clientId } } } }, limit);

import { asc, eq, min, sql, sumDistinct } from 'drizzle-orm';

import { crypto } from '@/lib/encrypt';
import { withFilter } from '@/lib/utils/drizzle';
import {
	config as configSchema,
	configTaxes,
	invoiceItems,
	invoices,
	itemTaxes,
	taxes as taxesSchema,
} from '@/db/schema';

/** Join relational (incl. item) details with a single invoice record for authenticated user */
export async function fetchInvoice(id: string) {
	const session = await getSession();
	if (!session) throw new Error('Request not authenticated');

	// Get all active taxes, and calculate sum for display in the invoice subtotals
	// Executed as CTE to collapse tax rows that share the same name (eg. GST(10%) and GST(5%) would share one sum)
	const taxContribution = db.$with('tax_calc').as(
		db
			.select({
				contribution:
					sql<number>`${withFilter(sumDistinct(invoiceItems.netAmount), eq(itemTaxes.taxId, taxesSchema.id))} * ${taxesSchema.rate} * ${configSchema.taxRegistration}::int`
						.mapWith(Number)
						.as('contribution'),

				taxId: taxesSchema.id,
				configId: configSchema.id,
				order: configTaxes.order,
				name: taxesSchema.name,
				rate: taxesSchema.rate,
			})
			.from(invoices)
			.where(eq(invoices.id, id))
			.innerJoin(configSchema, eq(invoices.configId, configSchema.id))
			.innerJoin(configTaxes, eq(configTaxes.configId, configSchema.id))
			.leftJoin(taxesSchema, eq(taxesSchema.id, configTaxes.taxId))
			.leftJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
			.leftJoin(itemTaxes, eq(itemTaxes.itemId, invoiceItems.id))
			.groupBy(configSchema.id, taxesSchema.id, configTaxes.order)
			.orderBy(configTaxes.order),
	);

	try {
		const [res, tax] = await Promise.all([
			db.query.invoicesWithSum.findFirst({
				where: { userId: { eq: session.user.id }, id: { eq: id } },
				columns: {
					clientDataId: false,
					configId: false,
					userId: false,
				},
				with: {
					clientData: true,
					config: {
						columns: {
							validFrom: false,
							validTo: false,
							id: false,
							userId: false,
							addressId: false,
						},
						with: { address: true },
					},
					items: { with: { taxes: true } },
				},
				orderBy: { index: 'desc' },
			}),

			// Collapse tax rows that share the same name
			db
				.with(taxContribution)
				.select({
					name: taxContribution.name,
					contribution: sumDistinct(taxContribution.contribution).mapWith(Number),
				})
				.from(taxContribution)
				.groupBy(taxContribution.name)
				.orderBy(asc(min(taxContribution.order))),
		]);

		if (!res) throw new Error('Invoice not found');

		const vault = await crypto(session.user.id);

		const [paymentDetails, registrationNumber, streetAddress] = await Promise.all([
			res.config.paymentDetails && vault.decrypt(...res.config.paymentDetails),
			res.config.registrationNumber && vault.decrypt(...res.config.registrationNumber),
			res.config.address?.streetAddress && vault.decrypt(...res.config.address.streetAddress),
		]);

		const inv = {
			...res,
			reference: invoiceReference(res, res.config.numberingScheme),
			config: {
				...res.config,
				paymentDetails,
				registrationNumber,
				address: res.config.address && {
					...res.config.address,
					streetAddress,
				},
			},
		};

		vault.destroy();

		return { ...inv, tax };
	} catch (error) {
		console.error('Database Error:', error);
		throw new Error('Failed to fetch invoice');
	}
}
