import { TZDate } from '@date-fns/tz';
import { type TDocumentDefinitions } from 'pdfmake/interfaces';

import { type fetchInvoice } from '@/lib/data/invoice';
import { type ElementType, formatDateToLocal } from '@/lib/utils';
import { formatAddress } from '@/lib/utils/address';

import schemes from '@/src/app/ui/color-schemes';

import { lineItemsTable } from './line-items';
import { fontSize, footerHeight, footerMargins, footerStyles, spacing } from './styles';
import { subtotalTable } from './subtotals';

// DefinitelyTyped package does not have 0.3.4 definitions
declare module 'pdfmake/interfaces' {
	interface TableCellProperties {
		verticalAlignment?: 'top' | 'middle' | 'bottom';
	}
}

type FetchResult = Awaited<ReturnType<typeof fetchInvoice>>;

/** A subset of API invoice data used for printing invoices */
export type InvoicePrintData = Omit<
	FetchResult,
	'id' | 'status' | 'items' | 'issueYear' | 'index' | 'yearIndex'
> & {
	// isVoid is the only mutable status that may be accessed
	status: Pick<FetchResult['status'], 'isVoid'>;

	// Gross amount is not displayed on a per-item basis, but rather deferred to the subtotal table
	items: Omit<ElementType<FetchResult['items']>, 'grossAmount'>[];
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
		footer: (_currentPage, _pageCount) => {
			return {
				style: 'footer',
				margin: [pageMargins[0], 0, pageMargins[2], 0],
				unbreakable: true,
				layout: {
					hLineWidth: () => footerStyles.border,
					vLineWidth: () => footerStyles.border,
					paddingBottom: () => footerMargins.marginBottom,
					paddingLeft: i => (i === 0 ? 0 : spacing(1)),
					paddingRight: i => (i > 0 ? 0 : spacing(1)),
				},
				table: {
					style: 'footer',
					widths: ['*', 0, '*'],
					dontBreakRows: true,
					body: [
						[
							{ stack: footerLeftContent, verticalAlignment: 'bottom' },
							{
								stack: [' '],
								opacity: 0,
								fontSize: 0.1,
								margin: [
									0,
									pageMargins[3] - footerMargins.marginBottom - footerMargins.safeAreaBottom,
									0,
									0,
								],
								verticalAlignment: 'bottom',
							},
							{
								text: `Issued ${formatDateToLocal(new TZDate(invoice.issuedAt, invoice.config.timezone), false, invoice.config.locale)}`,
								alignment: 'right',
								verticalAlignment: 'bottom',
							},
						],
					],
				},
			};
		},
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
			{
				style: 'footer',
				marginTop: -spacing(4),
				table: {
					widths: ['60%', '40%'],
					body: [
						[
							'',
							{
								alignment: 'right',
								text: invoice.config.tradingName,
								bold: true,
								color: colors.heavy,
								margin: [0, 0, 0, spacing(4)],
							},
						],
						[
							{
								text: invoice.config.header ?? '',
								marginLeft: spacing(5),
								marginRight: spacing(5),
							},
							{
								alignment: 'right',
								stack: [
									{ stack: invoice.config.registrationNumber || [] },

									invoice.config.email ? { text: invoice.config.email } : [],
									invoice.config.phone ? { text: invoice.config.phone } : [],

									invoice.config.address
										? [
												{
													text: formatAddress(invoice.config.address),
													marginTop: spacing(4),
												},
											]
										: [],
								],
							},
						],
					],
				},
				layout: {
					paddingTop: () => 0,
					paddingBottom: () => 0,
					paddingLeft: () => 0,
					paddingRight: () => 0,
					hLineWidth: () => 0,
					vLineWidth: () => 0,
				},
			},
			{
				text: (() => {
					const match = title.match(/(.+)(.-.)(.*)/);
					if (!match) return title;
					// Add spacing around hyphen without affecting copy/paste
					return [match[1], { text: match[2], characterSpacing: spacing(0.5) }, match[3]];
				})(),
				style: 'heading',
				margin: [spacing(5), spacing(18), 0, 0],
			},
			invoice.description
				? {
						text: invoice.description,
						style: 'body',
						margin: [spacing(5), spacing(3), spacing(5), 0],
						fontSize: fontSize.sm,
						lineHeight: 1.25,
					}
				: '',
			{
				table: {
					widths: ['70%', '30%'],
					body: [
						[
							{ text: invoice.title || '', bold: true },
							{
								text: `Due ${formatDateToLocal(new TZDate(invoice.dueAt, invoice.config.timezone), false, invoice.config.locale)}`,
								alignment: 'right',
								bold: true,
							},
						],
						[
							{
								stack: [
									{ text: 'Bill To', bold: true },
									invoice.clientData.name,
									invoice.clientData.address
										? [
												{
													text: formatAddress(invoice.clientData.address),
													marginTop: spacing(4),
												},
											]
										: [],
								],
								colSpan: 2,
							},
						],
					],
				},
				fontSize: fontSize.base,
				margin: [0, spacing(8)],
				layout: {
					fillColor: colors.gray,
					paddingTop: i => (i === 0 ? spacing(5) : 0),
					paddingBottom: () => spacing(5),
					paddingLeft: () => spacing(5),
					paddingRight: () => spacing(5),
					hLineWidth: () => 0,
					vLineWidth: () => 0,
				},
			},

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
