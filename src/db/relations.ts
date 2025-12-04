import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, r => ({
	// ---------------------------------------------------------
	// User Relations
	// ---------------------------------------------------------
	users: {
		accounts: r.many.accounts(),
		clients: r.many.clients(),
		invoices: r.many.invoices(),
		keychain: r.one.keychain({
			from: r.users.id,
			to: r.keychain.id,
		}),
		sessions: r.many.sessions(),
	},

	accounts: {
		user: r.one.users({
			from: r.accounts.userId,
			to: r.users.id,
		}),
	},

	sessions: {
		user: r.one.users({
			from: r.sessions.userId,
			to: r.users.id,
		}),
	},

	// ---------------------------------------------------------
	// Client & Client Data
	// ---------------------------------------------------------
	clients: {
		user: r.one.users({
			from: r.clients.userId,
			to: r.users.id,
		}),
		clientData: r.many.clientData(),
	},

	clientData: {
		client: r.one.clients({
			from: r.clientData.clientId,
			to: r.clients.id,
		}),
		user: r.one.users({
			from: r.clientData.userId,
			to: r.users.id,
		}),
		invoices: r.many.invoices({
			from: r.clientData.id,
			to: r.invoices.clientDataId,
		}),
	},

	// ---------------------------------------------------------
	// Invoices
	// ---------------------------------------------------------
	invoices: {
		user: r.one.users({
			from: r.invoices.userId,
			to: r.users.id,
		}),
		clientData: r.one.clientData({
			from: r.invoices.clientDataId,
			to: r.clientData.id,
		}),
		config: r.one.config({
			from: r.invoices.configId,
			to: r.config.id,
		}),
		items: r.many.invoiceItems({
			from: r.invoices.id,
			to: r.invoiceItems.invoiceId,
		}),
	},

	invoiceCount: {
		user: r.one.users({
			from: r.invoiceCount.userId,
			to: r.users.id,
		}),
	},

	invoiceItems: {
		taxes: r.many.taxes({
			from: r.invoiceItems.id.through(r.itemTaxes.itemId),
			to: r.taxes.id.through(r.itemTaxes.taxId),
		}),
	},

	// ---------------------------------------------------------
	// Taxes & Configuration
	// ---------------------------------------------------------
	config: {
		user: r.one.users({
			from: r.config.userId,
			to: r.users.id,
			optional: false,
		}),

		taxes: r.many.taxes({
			from: r.config.id.through(r.configTaxes.configId),
			to: r.taxes.id.through(r.configTaxes.taxId),
		}),

		invoices: r.many.invoices({
			from: r.config.id,
			to: r.invoices.configId,
		}),
	},

	taxes: {
		configs: r.many.config(),

		user: r.one.users({
			from: r.taxes.userId,
			to: r.users.id,
		}),
	},
}));
