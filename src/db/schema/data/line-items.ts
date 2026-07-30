import { type SQL, sql } from 'drizzle-orm';
import {
	foreignKey,
	index,
	integer,
	numeric,
	pgEnum,
	primaryKey,
	snakeCase,
	text,
	unique,
	uuid,
} from 'drizzle-orm/pg-core';

import { users } from '@/db/schema/auth';

import { authUid, policy } from './_helpers';
import { config, configTaxes, taxes } from './config';
import { documents } from './invoices';

export const unitEnum = pgEnum('unit', ['items', 'hours']);
export const lineItems = snakeCase.table(
	'line_item',
	{
		id: uuid().defaultRandom().primaryKey(),
		documentId: uuid()
			.notNull()
			.references(() => documents.id, { onDelete: 'cascade' }),

		/** Invoice entry label */
		label: text().notNull(),
		/** Optional information to describe the item */
		note: text(),

		quantity: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
		/** Unit by which quantity is measured. Unitless quantities are valid (eg. 3 hours; 6; 1 item) */
		unit: unitEnum(),
		unitCost: numeric({ precision: 12, scale: 4, mode: 'number' }).notNull(),

		netAmount: numeric({ precision: 19, scale: 4, mode: 'number' })
			.generatedAlwaysAs((): SQL => sql`${lineItems.quantity} * ${lineItems.unitCost}`)
			.notNull(),

		/** Optional sorting index */
		order: integer(),

		// User ID is propagated down to facilitate ownership constraints
		userId: uuid()
			.notNull()
			.references(() => users.id),
		// Config reference is propagated down to facilitate fk constraints on itemTaxes
		configId: uuid()
			.notNull()
			.references(() => config.id),
	},
	t => [
		unique('uq_line_item_id_config').on(t.id, t.configId),
		unique('uq_line_item_id_user_id').on(t.id, t.userId),

		index('idx_line_item_document_id').on(t.documentId),
		index('idx_line_item_user_id').on(t.userId),
		index('idx_line_item_config_id').on(t.configId),

		// Ensure this item references the same config as the associated invoice
		foreignKey({
			name: 'fk_line_item_document_config',
			columns: [t.documentId, t.configId],
			foreignColumns: [documents.id, documents.configId],
		}),
		foreignKey({
			name: 'fk_line_item_document_ownership',
			columns: [t.documentId, t.userId],
			foreignColumns: [documents.id, documents.userId],
		}),
		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			// Items must be immutable for stable invoice data
			update: false,
			// Delete only on cascade
			delete: false,
		}),
	],
);

/** Join table for invoice items and taxes */
export const itemTaxes = snakeCase.table(
	'item_tax',
	{
		itemId: uuid()
			.notNull()
			.references(() => lineItems.id, { onDelete: 'cascade' }),
		taxId: uuid()
			.notNull()
			.references(() => taxes.id),

		// User ID is stored down to facilitate ownership constraints
		userId: uuid()
			.notNull()
			.references(() => users.id),
		// Config reference is propagated down to facilitate fk constraints
		configId: uuid()
			.notNull()
			.references(() => config.id),
	},
	t => [
		primaryKey({ name: 'item_tax_pkey', columns: [t.itemId, t.taxId] }),

		index('idx_item_tax_tax_id').on(t.taxId),
		index('idx_item_tax_user_id').on(t.userId),
		index('idx_item_tax_config_id').on(t.configId),

		// Ensure this record references the same config as the associated item
		foreignKey({
			name: 'fk_item_tax_invoice_item',
			columns: [t.itemId, t.configId],
			foreignColumns: [lineItems.id, lineItems.configId],
		}),
		// Ensure tax is allowed for this configuration
		foreignKey({
			name: 'fk_item_tax_config_tax',
			columns: [t.configId, t.taxId],
			foreignColumns: [configTaxes.configId, configTaxes.taxId],
		}),

		policy({
			select: authUid(t.userId),
			insert: authUid(t.userId),
			// item/tax junction must be stable to prevent invoice totals changing
			update: false,
			// Delete only on cascade
			delete: false,
		}),
	],
);
