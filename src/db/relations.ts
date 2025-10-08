import { relations } from 'drizzle-orm';
import { clients, config, invoiceItems, invoices, itemTaxes, taxes, users } from '@/db/schema';

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
	client: one(clients, {
		fields: [invoices.clientId],
		references: [clients.id],
	}),
	user: one(users, {
		fields: [invoices.userId],
		references: [users.id],
	}),
	config: one(config, {
		fields: [invoices.config],
		references: [config.id],
	}),
	items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one, many }) => ({
	invoice: one(invoices, {
		fields: [invoiceItems.invoiceId],
		references: [invoices.id],
	}),
	// Once beta reaches release, this may be flattened with a {through: itemTaxes} config
	itemTax: many(itemTaxes),
}));

export const itemTaxRelations = relations(itemTaxes, ({ one }) => ({
	item: one(invoiceItems, {
		fields: [itemTaxes.itemId],
		references: [invoiceItems.id],
	}),
	tax: one(taxes, {
		fields: [itemTaxes.taxId],
		references: [taxes.id],
	}),
}));

export const taxRelations = relations(taxes, ({ one }) => ({
	user: one(users, {
		fields: [taxes.userId],
		references: [users.id],
	}),
}));

export const configRelations = relations(config, ({ one }) => ({
	user: one(users, {
		fields: [config.userId],
		references: [users.id],
	}),
}));

export const userRelations = relations(users, ({ many }) => ({
	config: many(config),
	tax: many(taxes),
}));
