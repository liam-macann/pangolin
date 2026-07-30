import {
	defineRelations,
	defineRelationsPart,
	type ExtractTablesFromSchema,
	type RelationsBuilder,
} from 'drizzle-orm';

import * as schema from './schema';

type Tables = ExtractTablesFromSchema<typeof schema>;

/** Helper function to define base relations for documents and derived views */
function documentBaseRelations(
	r: RelationsBuilder<Tables>,
	tableName: 'documents' | 'documentsWithSum',
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
			to: r.itemsWithTax.documentId,
		}),
	};
}

export const relations = defineRelations(schema, r => ({
	// ---------------------------------------------------------
	// User Relations
	// ---------------------------------------------------------
	users: {
		clients: r.many.clients(),
		documents: r.many.documents({
			from: r.users.id,
			to: r.documents.userId,
		}),
		invoices: r.many.invoices({
			from: r.users.id,
			to: r.invoices.userId,
		}),
		keychain: r.one.keychain({
			from: r.users.id,
			to: r.keychain.id,
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

		documents: r.many.documents({
			from: r.clientData.id,
			to: r.documents.clientDataId,
		}),

		invoices: r.many.invoices({
			from: r.clientData.id.through(r.documents.clientDataId),
			to: r.invoices.id.through(r.documents.id),
		}),
	},

	// ---------------------------------------------------------
	// Invoices
	// ---------------------------------------------------------
	documents: documentBaseRelations(r, 'documents'),
	documentsWithSum: documentBaseRelations(r, 'documentsWithSum'),

	invoices: {
		document: r.one.documents({
			from: r.invoices.id,
			to: r.documents.id,
			optional: false,
		}),
		documentWithSum: r.one.documentsWithSum({
			from: r.invoices.id,
			to: r.documentsWithSum.id,
			optional: false,
		}),
		status: r.one.invoiceStatus({
			from: r.invoices.id,
			to: r.invoiceStatus.id,
			optional: false,
		}),
	},

	sequencer: {
		user: r.one.users({
			from: r.sequencer.userId,
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

		documents: r.many.documents({
			from: r.config.id,
			to: r.documents.configId,
		}),

		invoices: r.many.invoices({
			from: r.config.id.through(r.documents.configId),
			to: r.invoices.id.through(r.documents.id),
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

export const authRelations = defineRelationsPart(schema, r => ({
	users: {
		sessions: r.many.sessions({
			from: r.users.id,
			to: r.sessions.userId,
		}),
		accounts: r.many.accounts({
			from: r.users.id,
			to: r.accounts.userId,
		}),
	},
	sessions: {
		users: r.one.users({
			from: r.sessions.userId,
			to: r.users.id,
		}),
	},
	accounts: {
		users: r.one.users({
			from: r.accounts.userId,
			to: r.users.id,
		}),
	},
}));
