import { eq, getColumns, sql, sum } from 'drizzle-orm';
import { snakeCase } from 'drizzle-orm/pg-core';

// Schema imports
import { config, taxes } from './config';
import { invoiceItems, invoices, itemTaxes } from './index';

//
//
//
// VIEWS
//

export const itemsWithTax = snakeCase
	.view('items_with_tax')
	.with({ securityInvoker: true })
	.as(qb =>
		qb
			.select({
				...getColumns(invoiceItems),
				taxRegistration: config.taxRegistration,
				/** @remarks This can safely be used regardless of tax registration. Unregistered taxes will not be applied. */
				grossAmount:
					sql`((1 + COALESCE(${sum(taxes.rate)} * ${config.taxRegistration}::INT, 0)) * ${invoiceItems.netAmount})::NUMERIC(15, 4)`
						.mapWith(Number)
						.as('gross_amount'),
			})
			.from(invoiceItems)
			.leftJoin(itemTaxes, eq(itemTaxes.itemId, invoiceItems.id))
			.leftJoin(taxes, eq(itemTaxes.taxId, taxes.id))
			.leftJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
			.leftJoin(config, eq(invoices.configId, config.id))
			.groupBy(invoiceItems.id, config.id),
	);

export const invoicesWithSum = snakeCase
	.view('invoice_with_sum')
	.with({ securityInvoker: true })
	.as(qb =>
		qb
			.select({
				...getColumns(invoices),
				taxRegistration: config.taxRegistration,
				currency: config.currency,
				netTotal: sum(itemsWithTax.netAmount).mapWith(Number).as('net_total'),
				/** @remarks This can safely be used regardless of tax registration. Unregistered taxes will not be applied. */
				grossTotal: sum(itemsWithTax.grossAmount).mapWith(Number).as('gross_total'),
			})
			.from(invoices)
			.innerJoin(config, eq(invoices.configId, config.id))
			.leftJoin(itemsWithTax, eq(itemsWithTax.invoiceId, invoices.id))
			.groupBy(invoices.id, config.id),
	);
