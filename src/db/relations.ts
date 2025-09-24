import { relations } from 'drizzle-orm';
import { clients, config, invoiceItems, invoices, users } from '@/db/schema';

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

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
	invoice: one(invoices, {
		fields: [invoiceItems.invoiceId],
		references: [invoices.id],
	}),
}));
