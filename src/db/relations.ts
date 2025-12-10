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
	invoices: invoiceBaseRelations(r, 'invoices'),
	invoicesWithSum: invoiceBaseRelations(r, 'invoicesWithSum'),

	invoiceCount: {
		user: r.one.users({
			from: r.invoiceCount.userId,
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
