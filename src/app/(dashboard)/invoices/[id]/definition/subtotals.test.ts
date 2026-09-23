import { assert, describe, expect, test } from 'vitest';

import { formatCurrency } from '@/lib/utils/currencies';

import { type InvoicePrintData } from './index';
import { subtotalTable } from './subtotals';
import { invoiceDataBuilder, renderText } from './tests/helpers';

describe('subtotalTable', () => {
	// The left column of the subtotal layout communicates when tax registration is disabled
	const getDisclaimers = (invoice: InvoicePrintData) => {
		const leftColumn = subtotalTable(invoice).columns[0];

		assert(
			typeof leftColumn === 'object' && !Array.isArray(leftColumn) && leftColumn.stack,
			'Expected left column to be a ContentStack',
		);

		return leftColumn.stack;
	};

	// The right column of the subtotal layout holds the figures table
	const getRightColumn = (invoice: InvoicePrintData) => {
		const rightColumn = subtotalTable(invoice).columns[1];

		assert(
			typeof rightColumn === 'object' && !Array.isArray(rightColumn) && rightColumn.table,
			'Expected right column to be a ContentTable',
		);

		return rightColumn;
	};

	const getTable = (invoice: InvoicePrintData) => getRightColumn(invoice).table.body;

	test('First row is the subtotal row', () => {
		const table = getTable(invoiceDataBuilder());
		expect(renderText(table[0][0])).toBe('Subtotal');
	});

	test('Last row is the total row', () => {
		const table = getTable(invoiceDataBuilder());
		expect(renderText(table[table.length - 1][0])).toBe('Total');
	});

	test.for([
		[{ name: 'GST', contribution: 100 }],
		[
			{ name: 'VAT', contribution: 0 },
			{ name: 'GST', contribution: 10 },
		],
		[
			{ name: 'LCT', contribution: 0 },
			{ name: 'VAT', contribution: 0 },
			{ name: 'GST', contribution: 0 },
		],
	])('Every tax is included in the subtotal table (test case %$)', taxes => {
		// Taxes defined in config should always be included in the subtotal table,
		// regardless of tax registration or whether applied to an item

		const subtotals = getTable(
			invoiceDataBuilder({
				config: { taxRegistration: false },
				tax: taxes,
				netTotal: 1000,
				grossTotal: 1100,
			}),
		);

		expect(subtotals).toHaveLength(taxes.length + 2);

		taxes.forEach((tax, index) => {
			expect(renderText(subtotals[1 + index][0])).toContain(tax.name);
		});
	});

	test.for([
		['GST', 'VAT', 'LCT'],
		['VAT', 'GST', 'LCT'],
		['LCT', 'GST', 'VAT'],
	])('Subtotal table is sensitive to tax array order: [%s, %s, …]', taxes => {
		const subtotals = getTable(
			invoiceDataBuilder({
				config: { taxRegistration: false },
				tax: taxes.map(t => ({ name: t })),
			}),
		);

		taxes.forEach((tax, index) => {
			expect(renderText(subtotals[1 + index][0])).toBe(`${tax} incl.`);
		});
	});

	test('Tax not applicable disclaimer is toggled with tax registration status', () => {
		// This disclaimer should only be shown when tax registration is disabled
		// regardless of whether tax has been applied or not.
		//
		// Tax may be applicable, but also not charged on this specific invoice.
		// (eg. GST exempt items)

		const taxRegistered = invoiceDataBuilder({
			config: { taxRegistration: true },
			items: [
				// Case where tax has been referenced on item
				{ taxes: [{ name: 'GST', rate: '0.5' }] },
				// Case where tax has been referenced on item, but not applied to item
				{ taxes: [{ name: 'LCT', rate: '0' }] },
				// Case where tax has not been referenced on item
				{ taxes: [] },
			],
			tax: [
				// Case where tax has been applied
				{ name: 'GST', contribution: 100 },

				// Case where tax has not been applied
				{ name: 'VAT', contribution: 0 },
				{ name: 'LCT', contribution: 0 },
			],
		});

		expect(getDisclaimers(taxRegistered)).toHaveLength(0);

		const taxUnregistered: InvoicePrintData = {
			...taxRegistered,
			config: { ...taxRegistered.config, taxRegistration: false },
		};

		const disclaimers = getDisclaimers(taxUnregistered);
		expect(disclaimers).toHaveLength(3);
	});

	test.for([
		['GST', 'VAT', 'LCT'],
		['VAT', 'GST', 'LCT'],
		['LCT', 'GST', 'VAT'],
	])('Tax disclaimer is sensitive to array order: [%s, %s, ...]', taxes => {
		const inv = invoiceDataBuilder({
			config: { taxRegistration: false },
			tax: taxes.map(t => ({ name: t })),
		});

		const disclaimers = getDisclaimers(inv);
		expect(disclaimers).toHaveLength(taxes.length);

		taxes.forEach((tax, index) => {
			expect(renderText(disclaimers[index])).toContain(tax);
		});
	});

	test('Subtotal, tax, and total cells render the formatted currency amounts', () => {
		const invoice = invoiceDataBuilder({
			config: { taxRegistration: false, currency: 'AUD', locale: 'de' },
			tax: [
				{ name: 'GST', contribution: 45.5 },
				{ name: 'LCT', contribution: 0 },
			],
			netTotal: 455,
			grossTotal: 500.5,
		});

		const table = getTable(invoice);
		const { currency, locale } = invoice.config;

		// Subtotal cell
		expect(renderText(table[0][1])).toBe(formatCurrency(invoice.netTotal, currency, locale));

		// Each tax row
		invoice.tax.forEach((tax, index) => {
			expect(renderText(table[1 + index][1])).toBe(
				formatCurrency(tax.contribution, currency, locale),
			);
		});

		// Total cell
		expect(renderText(table[table.length - 1][1])).toBe(
			formatCurrency(invoice.grossTotal, currency, locale),
		);
	});
});
