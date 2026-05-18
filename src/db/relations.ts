import { defineRelations, type ExtractTablesFromSchema, type RelationsBuilder } from 'drizzle-orm';

import * as schema from './schema';

type Tables = ExtractTablesFromSchema<typeof schema>;

/** Helper function to define base relations for invoices and derived views */
function invoiceBaseRelations(
	r: RelationsBuilder<Tables>,
	tableName: 'invoices' | 'invoicesWithSum',
) {
	const table = r[tableName];

	return {
		user: r.one.users({
			from: table.userId,
			to: r.users.id,
			optional: false,
		}),
		clientData: r.one.clientData({
			from: table.clientDataId,
			to: r.clientData.id,
			optional: false,
		}),
		config: r.one.config({
			from: table.configId,
			to: r.config.id,
			optional: false,
		}),
		items: r.many.itemsWithTax({
			from: table.id,
			to: r.itemsWithTax.invoiceId,
		}),
		status: r.one.invoiceStatus({
			from: table.id,
			to: r.invoiceStatus.id,
			optional: false,
		}),
	};
}

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
		data: r.many.clientData(),
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
		address: r.one.address({
			from: r.clientData.addressId,
			to: r.address.id,
		}),
		invoices: r.many.invoices({
			from: r.clientData.id,
			to: r.invoices.clientDataId,
		}),
	},

	// ---------------------------------------------------------
	// Invoices
	// ---------------------------------------------------------
	invoices: invoiceBaseRelations(r, 'invoices'),
	invoicesWithSum: invoiceBaseRelations(r, 'invoicesWithSum'),

	invoiceCount: {
		user: r.one.users({
			from: r.invoiceCount.userId,
			to: r.users.id,
		}),
	},

	invoiceYearCount: {
		user: r.one.users({
			from: r.invoiceYearCount.userId,
			to: r.users.id,
		}),
	},

	itemsWithTax: {
		taxes: r.many.taxes({
			from: r.itemsWithTax.id.through(r.itemTaxes.itemId),
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

		address: r.one.address({
			from: r.config.addressId,
			to: r.address.id,
		}),

		configTaxes: r.many.configTaxes(),

		invoices: r.many.invoices({
			from: r.config.id,
			to: r.invoices.configId,
		}),
	},

	taxes: {
		configs: r.many.config({
			from: r.taxes.id.through(r.configTaxes.taxId),
			to: r.config.id.through(r.configTaxes.configId),
		}),

		user: r.one.users({
			from: r.taxes.userId,
			to: r.users.id,
		}),
	},

	configTaxes: {
		configs: r.one.config({
			from: r.configTaxes.configId,
			to: r.config.id,
			optional: false,
		}),
		taxes: r.one.taxes({
			from: r.configTaxes.taxId,
			to: r.taxes.id,
			optional: false,
		}),
	},
}));
