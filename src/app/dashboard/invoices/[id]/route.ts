import path from 'node:path';
import { TZDate } from '@date-fns/tz';
import { type NextRequest, NextResponse } from 'next/server';
import pdfmake, { type Content, type TableCell } from 'pdfmake';

import { fetchInvoice } from '@/lib/data/invoice';
import { formatCurrency, formatDateToLocal, formatNumber, pluralize } from '@/lib/utils';
import { fetchAddressMetadata, formatAddress } from '@/lib/utils/address';
import { type Enum } from '@/lib/utils/drizzle';
import { type unitEnum } from '@/db/schema/data';

// DefinitelyTyped package does not have 0.3.4 definitions
declare module 'pdfmake/interfaces' {
	interface TableCellProperties {
		verticalAlignment?: 'top' | 'middle' | 'bottom';
	}
}

import { getRegisteredCountries } from 'lib-address';

import { getSession } from '@/auth';
import schemes from '@/src/app/ui/color-schemes';

const fontSize = {
	base: 10,
	/** Headers and footers */
	sm: 11,
	/** Headings */
	lg: 14,
};

/** Get the singular equivalent of a unit (stored as plural enum) */
const singularUnits: Record<Enum<typeof unitEnum>, string> = {
	hours: 'hour',
	items: 'item',
};

/** Convert pixels to points */
const px = (v: number) => (v / 4) * 3;
const spacing = (i: number) => px(4 * i);

const footerStyles = {
	border: 0,
	fontSize: fontSize.sm,
	lineHeight: 1,
};

// Yes, this is a magic number multiplier. Exact `1` failed, despite lineHeight being set on footer styles.
// Tested between 1–50 lines
const footerLineHeight = (n: number) => n * footerStyles.fontSize * footerStyles.lineHeight * 1.22;

const footerMargins = {
	/** Applied as padding to table layout. The gutter between footer end and page end. */
	marginBottom: spacing(12),

	/** Prevent overflow due to text being too close to padding. Magic number. */
	safeAreaTop: footerLineHeight(1),

	/** Prevent overflow due to text being too close to padding. Magic number. */
	safeAreaBottom: footerLineHeight(1),
};

const footerHeight = (lines: number) => {
	// Lines incremented for safe area
	const textHeight = footerLineHeight(lines);

	const tablePadding = 2; // Default pdfmake top-padding

	return (
		textHeight +
		tablePadding +
		footerStyles.border * 2 +
		footerMargins.marginBottom +
		footerMargins.safeAreaTop +
		footerMargins.safeAreaBottom
	);
};

export async function GET(_request: NextRequest, ctx: RouteContext<'/dashboard/invoices/[id]'>) {
	const { id: invoiceId } = await ctx.params;

	const session = await getSession();
	if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const buffer = await generatePdf(invoiceId);

	if (!buffer) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

	return new NextResponse(new Uint8Array(buffer), {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'inline; filename=invoice.pdf',
		},
	});
}

async function generatePdf(invoiceId: string) {
	const invoice = await fetchInvoice(invoiceId);
	if (!invoice) return;

	const registered = getRegisteredCountries().map(c => c.value);

	// At build, all countries should be registered. During dev, fetch metadata for any non-registered country.
	if (invoice.config.address?.country && !registered.includes(invoice.config.address.country)) {
		await fetchAddressMetadata(invoice.config.address.country);
	}

	pdfmake.addFonts({
		InstrumentSans: {
			normal: path.resolve('./src/fonts/InstrumentSans+Noto-Regular.ttf'),
			bold: path.resolve('./src/fonts/InstrumentSans+Noto-Semibold.ttf'),
		},
	});

	const colors = schemes[invoice.config.colorScheme];

	/** Necessary before execution to estimate bottom margin height */
	const footerLeftContent: string[] = invoice.config.paymentDetails || [];

	const pageMargins: [number, number, number, number] = [
		spacing(18), // L
		spacing(18), // T
		spacing(18), // R
		footerHeight(footerLeftContent.length), // B
	];

	const reference = `${invoice.config.taxRegistration ? 'Tax ' : ''}Invoice ${invoice.reference}`;

	const pdfDoc = pdfmake.createPdf({
		version: '1.5',
		subset: 'PDF/A-3a',
		tagged: true,
		displayTitle: true,
		info: {
			title: reference,
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
					const match = reference.match(/(.+)(.-.)(.*)/);
					if (!match) return reference;
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
	});

	return pdfDoc.getBuffer();
}

function lineItemsTable({ config, ...invoice }: Awaited<ReturnType<typeof fetchInvoice>>): Content {
	const colors = schemes[config.colorScheme];

	return {
		table: {
			headerRows: 1,
			dontBreakRows: true,
			widths: ['*', 70, ...(config.taxRegistration ? [70] : []), 60, 70],
			body: [
				[
					{ text: 'Description', alignment: 'left' },
					'Quantity',
					...(config.taxRegistration ? ['Tax'] : []),
					'Each',
					'Amount',
				],
				...(invoice.items?.map((item): TableCell[] => [
					{
						stack: [
							{ text: item.label },
							...(item.note
								? [{ text: item.note, color: colors.accent, bold: false, marginTop: spacing(0.5) }]
								: []),
						],

						alignment: 'left',
						fontFeatures: ['liga', 'ss01', 'ss03', 'ss04', 'ss05', 'pnum'],
						verticalAlignment: 'middle',
					},
					{
						text: `${formatNumber(item.quantity, config.locale)} ${item.unit ? pluralize(item.quantity, singularUnits[item.unit], item.unit) : ''}`.trim(),
						bold: false,
						fontFeatures: ['liga', 'ss01', 'ss03', 'ss04', 'ss05', 'pnum'],
						verticalAlignment: 'middle',
					},
					...(config.taxRegistration
						? ([
								{
									text:
										item.taxes.length > 0
											? item.taxes.map(tax => `${tax.name}(${tax.rate * 100}%)`).join(' ')
											: '–',
									bold: false,
									verticalAlignment: 'middle',
								},
							] as const)
						: []),
					{
						text: formatCurrency(item.unitCost, config.currency, config.locale),
						bold: false,
						verticalAlignment: 'middle',
					},
					{
						text: formatCurrency(item.netAmount, config.currency, config.locale),
						verticalAlignment: 'middle',

						// Margin acts similar to minHeight, as smaller padding is allowed with multiline description
						margin: [0, spacing(4)],
					},
				]) || []),
			],
		},
		bold: true,
		alignment: 'right',
		fontSize: fontSize.base,
		fontFeatures: ['liga', 'ss01', 'ss03', 'ss04', 'ss05', 'tnum', 'lnum'],
		layout: {
			paddingTop: () => spacing(2),
			paddingBottom: () => spacing(2),
			paddingLeft: () => spacing(2),
			paddingRight: () => spacing(2),

			vLineWidth: () => 0,
			hLineWidth: (i: number) => (i <= 1 ? 1 : 0.75),
			hLineColor: (i: number) => (i <= 1 ? colors.black : colors.accent),
			hLineStyle: i => (i <= 1 ? null : { dash: { length: 0.75, space: 1.5 } }),
		},
	};
}

function subtotalTable({ config, ...invoice }: Awaited<ReturnType<typeof fetchInvoice>>): Content {
	const colors = schemes[config.colorScheme];

	return {
		marginTop: spacing(6),
		columnGap: spacing(2),
		columns: [
			{
				stack: config.taxRegistration
					? ['']
					: [...(invoice.tax.map(t => `${t.name} not applicable`) || 'Tax not applicable')],
				color: colors.accent,
				fontSize: fontSize.base,
				marginLeft: spacing(2),
			},
			{
				width: 'auto',
				unbreakable: true,
				table: {
					dontBreakRows: true,
					widths: [80, 100],
					body: [
						[
							{ text: 'Subtotal', verticalAlignment: 'bottom' },
							{
								text: formatCurrency(invoice.netTotal, config.currency, config.locale),
								alignment: 'right',
								verticalAlignment: 'bottom',
							},
						],
						...invoice.tax.map((tax, i): [TableCell, TableCell] => [
							{
								text: `${tax.name} incl.`,
								color: colors.accent,
								verticalAlignment: 'bottom',

								// Margin before 'Total' line
								marginBottom: i === invoice.tax.length - 1 ? spacing(1) : 0,
							},
							{
								text: formatCurrency(tax.contribution, config.currency, config.locale),
								alignment: 'right',
								color: colors.accent,
								verticalAlignment: 'bottom',

								// Margin before 'Total' line
								marginBottom: i === invoice.tax.length - 1 ? spacing(1) : 0,
							},
						]),
						[
							{ text: 'Total', bold: true, verticalAlignment: 'bottom' },
							{
								text: formatCurrency(invoice.grossTotal, config.currency, config.locale),
								alignment: 'right',
								bold: true,
								fontSize: fontSize.lg,
								marginTop: spacing(3),
								verticalAlignment: 'bottom',
							},
						],
					],
				},
				fontSize: fontSize.base,
				fontFeatures: ['liga', 'ss01', 'ss03', 'ss04', 'ss05', 'tnum', 'lnum'],
				layout: {
					paddingTop: () => spacing(0),
					paddingBottom: () => spacing(2),
					paddingLeft: () => spacing(2),
					paddingRight: () => spacing(2),
					vLineWidth: () => 0,
					hLineWidth: (i, node) => (i + 1 === node.table.body.length ? 1 : 0),
					hLineColor: () => colors.accent,
				},
			},
		],
	};
}
