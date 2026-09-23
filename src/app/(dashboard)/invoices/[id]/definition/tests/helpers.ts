import { randomUUID } from 'node:crypto';
import { toMerged } from 'es-toolkit/object';
import { type Content, type ContentText, type TableCell } from 'pdfmake/interfaces';

import { type ElementType, type Minimized, type PartialDeep } from '@/lib/utils';

import { type InvoicePrintData } from './../index';

/** Helper to generate an invoice with optional overrides */
export const invoiceDataBuilder = (data?: PartialDeep<InvoicePrintData>): InvoicePrintData => {
	/** A minimally-populated invoice. Merge with data specific to what is being tested. */
	const base: Minimized<InvoicePrintData> = {
		title: null,
		description: null,
		createdAt: '2025-01-15T00:00:00.000Z',
		issuedAt: '2025-01-15',
		dueAt: '2025-02-15',
		reference: 'INV-001',
		netTotal: '1000.0000',
		grossTotal: '1000.0000',
		status: { isVoid: false },
		clientData: { name: null, organization: null, address: null },
		config: {
			id: randomUUID(),
			tradingName: 'My Business',
			email: null,
			phone: null,
			header: null,
			timezone: 'Australia/Sydney',
			language: 'en',
			region: 'AU',
			locale: 'en-AU',
			currency: 'AUD',
			colorScheme: 'blue',
			taxRegistration: false,
			paymentDetails: null,
			tradingNumber: null,
			address: null,
			numberingScheme: 'sequential',
			taxes: [],
		},
		items: [],
		tax: [],
	};

	const baseItem: Minimized<ElementType<InvoicePrintData['items']>> = {
		label: 'Development',
		note: null,
		quantity: '10.00',
		unit: null,
		unitCost: '100.0000',
		netAmount: '1000.0000',
		taxes: [],
	};

	const baseItemTaxes: Minimized<ElementType<ElementType<InvoicePrintData['items']>['taxes']>> = {
		name: 'GST',
		rate: '0.1000',
	};

	const baseTax: Minimized<ElementType<InvoicePrintData['tax']>> = {
		name: 'GST',
		contribution: '100.0000',
	};

	const { items: partialItems, tax: partialTax, ...partial } = data ?? {};

	return {
		...toMerged(base, partial),

		items:
			partialItems?.map(partial => {
				if (!partial) return baseItem;

				// Merge item-tax relationships
				return toMerged(
					baseItem,
					toMerged(partial, { taxes: partial.taxes?.map(t => toMerged(baseItemTaxes, t ?? {})) }),
				);
			}) ?? base.items,

		// Merge tax contributions
		tax: partialTax?.map(partial => toMerged(baseTax, partial ?? {})) ?? base.tax,
	};
};

//
//
// Helpers
//

/** TableCell uses empty objects (`{}`) as placeholders. Filter these out to get back to Content type. */
export const cellToContent = (cells: TableCell[]): Content =>
	cells.filter(
		(cell): cell is Content => !(typeof cell === 'object' && Object.keys(cell).length === 0),
	);

/** A {@link ContentText} node that cannot contain any nested content. */
type FlatContentText = Omit<ContentText, 'text'> & { text: string };

/** Accepts a pdfmake {@link Content} node, and collects all text nodes into an array. */
export function collectTextNodes(node: Content | TableCell, acc: FlatContentText[] = []) {
	if (!node || typeof node !== 'object') {
		if (typeof node === 'string') acc.push({ text: node });

		// Numbers are treated as printable content, and so are converted to strings here
		if (typeof node === 'number') acc.push({ text: node.toString() });
		return acc;
	}

	if (Array.isArray(node)) {
		node.flatMap(child => collectTextNodes(child, acc));
		return acc;
	}

	if (node.text) {
		if (typeof node.text === 'string') acc.push({ ...node, text: node.text });
		else if (typeof node.text === 'number') acc.push({ ...node, text: node.text.toString() });
		// `node.text` can itself be an array or object
		else collectTextNodes(node.text, acc);
	}

	if (node.toc?.title) collectTextNodes(node.toc.title, acc);

	(['columns', 'stack', 'ul', 'ol', 'section'] as const).forEach(key => {
		if (node[key]) collectTextNodes(node[key], acc);
	});

	if (node.table) {
		const { body } = node.table;
		collectTextNodes(cellToContent(body.flat()), acc);
	}

	return acc;
}

/** Accepts a {@link Content} node and returns rendered text content as a concatenated string. */
export const renderText = (nodes: Content | TableCell) =>
	collectTextNodes(nodes)
		.map(node => node.text)
		.join('');
