import { assert, describe, expect, test } from 'vitest';

import { lineItemsTable } from './line-items';
import { cellToContent, collectTextNodes, invoiceDataBuilder, renderText } from './tests/helpers';

describe('lineItemsTable', () => {
	/** Returns the index of the tax column in the line items table, assuming that tax registration is enabled */
	const taxColumnIndex = () => {
		const { table } = lineItemsTable(invoiceDataBuilder({ config: { taxRegistration: true } }));

		// Will fail if the header configuration changes, meaning the test needs to be updated.
		assert(table.headerRows === 1, 'Expected a single header row, to find correct column index');

		const header = table.body[0];
		// Convert cells to consistent array of text nodes
		const textNodes = collectTextNodes(cellToContent(header));

		// If this fails, then there are likely multiple text nodes in a header cell.
		// This does not mean the code is incorrect, but it does mean the test needs to be updated.
		assert(
			header.length === textNodes.length,
			'Expected header row to have the same number of text nodes as columns',
		);

		return textNodes.findIndex(v => v.text === 'Tax');
	};

	test.for([
		['Raspberries', 'Guava', 'Grape'],
		['Grape', 'Raspberries', 'Guava'],
		['Lemon', 'Apricot', 'Durian', 'Yuzu', 'Apple'],
	])('Line item table is sensitive to array order: [%s, %s, …]', items => {
		const { table } = lineItemsTable(
			invoiceDataBuilder({ items: items.map(label => ({ label })) }),
		);

		const headerRows = table.headerRows ?? 0;

		items.forEach((item, index) => {
			expect(renderText(table.body[headerRows + index][0])).toBe(item);
		});
	});

	describe('Tax column', () => {
		test.for([
			{ status: true, columns: 5 },
			{ status: false, columns: 4 },
		])('Expected column count [$columns] when taxRegistration = $status', ({ status, columns }) => {
			const { table } = lineItemsTable(
				invoiceDataBuilder({ config: { taxRegistration: status }, items: [{}] }),
			);

			expect(table.widths).toHaveLength(columns);

			// Evaluate each header row
			for (let i = 0; i < (table.headerRows || 0); i++) {
				expect(table.body[i]).toHaveLength(columns);
			}

			// Evaluates only the first line item (assume all items have the same structure)
			expect(table.body[table.headerRows || 0]).toHaveLength(columns);
		});

		test('Tax cell shows applied taxes with rate', () => {
			const { table } = lineItemsTable(
				invoiceDataBuilder({
					config: { taxRegistration: true },
					items: [{ taxes: [{ name: 'GST', rate: 0.1 }] }],
				}),
			);

			const col = taxColumnIndex();

			// Gets the tax cell from the first item row
			const taxCell = table.body[table.headerRows ?? 0][col];

			expect(renderText(taxCell)).toBe('GST(10%)');
		});

		test('Tax cell shows dash when item has no applicable taxes', () => {
			const { table } = lineItemsTable(
				invoiceDataBuilder({
					config: { taxRegistration: true },
					items: [{ taxes: [] }],
				}),
			);

			const col = taxColumnIndex();

			// Gets the tax cell from the first item row
			const taxCell = table.body[table.headerRows ?? 0][col];

			expect(renderText(taxCell)).toBe('–'); // en-dash character
		});
	});

	test('Description stack includes note when present', () => {
		const { table } = lineItemsTable(
			invoiceDataBuilder({ items: [{ note: 'Unframed print, edition 2 of 10' }] }),
		);

		const col = 0;
		const descCell = table.body[table.headerRows ?? 0][col];

		assert(
			typeof descCell === 'object' && !Array.isArray(descCell) && descCell.stack,
			'Description cell should be a ContentStack',
		);

		expect(descCell.stack).toHaveLength(2);
	});

	test('Description stack omits note when null', () => {
		const { table } = lineItemsTable(invoiceDataBuilder({ items: [{ note: null }] }));

		const col = 0;
		const descCell = table.body[table.headerRows ?? 0][col];

		assert(
			typeof descCell === 'object' && !Array.isArray(descCell) && descCell.stack,
			'Description cell should be a ContentStack',
		);

		expect(descCell.stack).toHaveLength(1);
	});
});
