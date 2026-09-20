import { eq, getColumns, sql, sum } from 'drizzle-orm';
import { snakeCase } from 'drizzle-orm/pg-core';

import { coalesce } from '@/lib/utils/drizzle';

// Schema imports
import { config, taxes } from './config';
import { documents, itemTaxes, lineItems } from './index';

//
//
//
// VIEWS
//

export const itemsWithTax = snakeCase
	.view('items_with_tax')
	.with({ securityInvoker: true, securityBarrier: true })
	.as(qb =>
		qb
			.select({
				...getColumns(lineItems),
				taxRegistration: config.taxRegistration,
				/** @remarks This can safely be used regardless of tax registration. Unregistered taxes will not be applied. */
				grossAmount:
					sql`((1 + COALESCE(${sum(taxes.rate)} * ${config.taxRegistration}::INT, 0)) * ${lineItems.netAmount})::NUMERIC(19, 4)`
						.mapWith(lineItems.netAmount)
						.as('gross_amount'),
			})
			.from(lineItems)
			.leftJoin(itemTaxes, eq(itemTaxes.itemId, lineItems.id))
			.leftJoin(taxes, eq(itemTaxes.taxId, taxes.id))
			.leftJoin(documents, eq(lineItems.documentId, documents.id))
			.leftJoin(config, eq(documents.configId, config.id))
			.groupBy(lineItems.id, config.id),
	);

export const documentsWithSum = snakeCase
	.view('document_with_sum')
	.with({ securityInvoker: true, securityBarrier: true })
	.as(qb =>
		qb
			.select({
				...getColumns(documents),
				taxRegistration: config.taxRegistration,
				currency: config.currency,
				netTotal: coalesce(sum(itemsWithTax.netAmount), 0).mapWith(Number).as('net_total'),
				/** @remarks This can safely be used regardless of tax registration. Unregistered taxes will not be applied. */
				grossTotal: coalesce(sum(itemsWithTax.grossAmount), 0).mapWith(Number).as('gross_total'),
			})
			.from(documents)
			.innerJoin(config, eq(documents.configId, config.id))
			.leftJoin(itemsWithTax, eq(itemsWithTax.documentId, documents.id))
			.groupBy(documents.id, config.id),
	);
