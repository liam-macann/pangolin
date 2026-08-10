import { type Content, type TDocumentDefinitions } from 'pdfmake/interfaces';

import { type DetailedInvoice } from '@/lib/data/invoice';
import { type ElementType } from '@/lib/utils';

import schemes from '@/src/app/ui/color-schemes';

import { addresseeTable } from './addressee';
import { documentFooter } from './footer';
import { letterheadTable } from './letterhead';
import { lineItemsTable } from './line-items';
import { fontSize, footerHeight, footerStyles, spacing } from './styles';
import { subtotalTable } from './subtotals';

// DefinitelyTyped package does not have 0.3.4 definitions
declare module 'pdfmake/interfaces' {
	interface TableCellProperties {
		verticalAlignment?: 'top' | 'middle' | 'bottom';
	}
}

/** A subset of API invoice data used for printing invoices */
export type InvoicePrintData = Omit<
	DetailedInvoice,
	'id' | 'status' | 'items' | 'partition' | 'index'
> & {
	// isVoid is the only mutable status that may be accessed
	status: Pick<DetailedInvoice['status'], 'isVoid'>;

	// Gross amount is not displayed on a per-item basis, but rather deferred to the subtotal table
	items: Omit<ElementType<DetailedInvoice['items']>, 'grossAmount'>[];
};

export function buildDocDefinition(invoice: InvoicePrintData): TDocumentDefinitions {
	const colors = schemes[invoice.config.colorScheme];

	/** Necessary before execution to estimate bottom margin height */
	const footerLeftContent: string[] = invoice.config.paymentDetails || [];

	const pageMargins: [number, number, number, number] = [
		spacing(18), // L
		spacing(18), // T
		spacing(18), // R
		footerHeight(footerLeftContent.length), // B
	];

	const title = `${invoice.config.taxRegistration ? 'Tax ' : ''}Invoice ${invoice.reference}`;

	return {
		version: '1.5',
		subset: 'PDF/A-3a',
		tagged: true,
		displayTitle: true,
		info: {
			title: title,
			author: invoice.config.tradingName,
			creator: 'Invoicer',
			producer: 'Invoicer',
			creationDate: invoice.createdAt,
			modDate: invoice.createdAt,
		},
		pageSize: 'A4',
		defaultStyle: {
			font: 'InstrumentSans',
			fontFeatures: ['liga', 'ss01', 'ss03', 'ss04', 'ss05'],
		},
		pageMargins,
		footer: documentFooter(invoice, pageMargins),
		...(invoice.status.isVoid
			? {
					watermark: {
						text: 'VOID',
						color: 'red',
						opacity: 0.3,
						bold: true,
						fontSize: 176,
						angle: -45,
					},
				}
			: {}),
		content: [
			letterheadTable(invoice),
			titleHeading(title),
			invoice.description
				? {
						text: invoice.description,
						style: 'body',
						margin: [spacing(5), spacing(3), spacing(5), 0],
						fontSize: fontSize.sm,
						lineHeight: 1.25,
					}
				: '',
			addresseeTable(invoice),
			lineItemsTable(invoice),
			subtotalTable(invoice),
		],
		styles: {
			heading: {
				fontSize: fontSize.lg,
				bold: true,
				color: colors.accent,
			},
			footer: {
				fontSize: footerStyles.fontSize,
				lineHeight: footerStyles.lineHeight,
				color: colors.accent,
			},
		},
	};
}

/** The invoice reference heading. Adds optical spacing around a hyphen in the reference number, without affecting copy/paste. */
function titleHeading(title: string): Content {
	const match = title.match(/(.+)(.-.)(.*)/);

	return {
		text: match ? [match[1], { text: match[2], characterSpacing: spacing(0.5) }, match[3]] : title,
		style: 'heading',
		margin: [spacing(5), spacing(18), 0, 0],
	};
}
