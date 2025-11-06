import path from 'node:path';
import { NextResponse } from 'next/server';
import PdfPrinter from 'pdfmake';
import { fetchInvoice, getUser } from '@/lib/data';
import { BottomLayout, CenteredLayout } from '@/lib/pdf-verticalalign';
import { formatCurrency, formatDateToLocal, formatNumber } from '@/lib/utils';

const colors = {
	black: '#000000',
	/** Accent text */
	accent: '#5EAB92',
	/** Toned black */
	heavy: '#266453',
	/** Backgrounds */
	gray: '#f2f9f7',
};

const fontSize = {
	base: 10,
	/** Headers and footers */
	sm: 11,
	/** Headings */
	lg: 14,
};

/** Convert pixels to points */
const px = (v: number) => (v / 4) * 3;
const spacing = (i: number) => px(4 * i);

export async function GET(_request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const [invoice, user] = await Promise.all([fetchInvoice(id), getUser()]);

	if (!invoice) {
		return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
	}

	const fonts = {
		Roboto: {
			normal: path.resolve('./public/InstrumentSans-Regular.ttf'),
			bold: path.resolve('./public/InstrumentSans-Semibold.ttf'),
		},
	};

	const printer = new PdfPrinter(fonts);

	const pageMargins: [number, number, number, number] = [
		spacing(18),
		spacing(14),
		spacing(18),
		spacing(28),
	];

	const reference = `${invoice.config.taxRegistration ? 'Tax ' : ''}Invoice ${invoice.formatted.reference}`;

	const pdfDoc = printer.createPdfKitDocument({
		version: '1.5',
		subset: 'PDF/A-3a',
		tagged: true,
		displayTitle: true,
		info: {
			title: reference,
			author: user.name,
			creator: 'Invoicer',
			producer: 'Invoicer',
			creationDate: invoice.createdAt,
			modDate: invoice.createdAt,
		},
		pageSize: 'A4',
		pageMargins,
		footer: (_currentPage, _pageCount) => {
			return {
				style: 'footer',
				margin: [pageMargins[0], 0, pageMargins[2], 0],
				layout: {
					...BottomLayout,
					hLineWidth: () => 0,
					vLineWidth: () => 0,
					paddingBottom: () => 0,
					paddingLeft: i => (i === 0 ? 0 : spacing(1)),
					paddingRight: i => (i > 0 ? 0 : spacing(1)),
				},
				table: {
					style: 'footer',
					widths: ['*', '*'],
					body: [
						[
							{
								stack: ['Name: First Lastname', 'BSB: 123 456', 'Acc #: 123 456 789'],
							},
							{
								text: `Issued ${formatDateToLocal(invoice.issuedAt, false, 'en-AU')}`,
								alignment: 'right',
							},
						],
					],
				},
			};
		},
		content: [
			{
				style: 'footer',
				alignment: 'right',
				stack: [
					{
						text: user.name,
						bold: true,
						color: colors.heavy,
						margin: [0, 0, 0, spacing(4)],
					},
					{ text: 'ABN 00 000 000 000' },
					{ text: user.email },
				],
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
					widths: ['*', '30%'],
					body: [
						[
							{ text: invoice.title, bold: true },
							{
								width: '30%',
								text: `Due ${formatDateToLocal(invoice.dueAt, false, invoice.config.locale)}`,
								alignment: 'right',
								bold: true,
							},
						],
						[{ stack: [{ text: 'Bill To', bold: true }, invoice.client.name], colSpan: 2 }],
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
			{
				table: {
					headerRows: 1,
					widths: ['*', 70, ...(invoice.config.taxRegistration ? [70] : []), 60, 70],
					body: [
						[
							{ text: 'Description', alignment: 'left' },
							'Quantity',
							...(invoice.config.taxRegistration ? ['Tax'] : []),
							'Each',
							'Amount',
						],
						...(invoice.items?.map(item => [
							{
								stack: [
									{ text: item.label, marginBottom: spacing(0.5) },
									{ text: item.note, color: colors.accent, bold: false },
								],
								alignment: 'left',
								fontFeatures: ['pnum'],
								margin: [0, spacing(2)],
							},
							{
								text: `${formatNumber(item.quantity, invoice.config.locale)} ${item.unit ?? ''}`.trim(),
								bold: false,
								fontFeatures: ['pnum'],
							},
							...(invoice.config.taxRegistration
								? [
										{
											text:
												item.taxes.length > 0
													? item.taxes.map(tax => `${tax.name}(${tax.rate * 100}%)`).join(' ')
													: '–',
											bold: false,
										},
									]
								: []),
							{
								text: formatCurrency(item.unitCost, invoice.config.currency, invoice.config.locale),
								bold: false,
							},
							{
								text: formatCurrency(
									item.netAmount,
									invoice.config.currency,
									invoice.config.locale,
								),
								margin: [0, spacing(6)],
							},
						]) || []),
					],
				},
				bold: true,
				alignment: 'right',
				fontSize: fontSize.base,
				fontFeatures: ['tnum', 'lnum'],
				layout: {
					...CenteredLayout,
					paddingTop: (i, node) => (i === 0 ? spacing(2) : CenteredLayout.paddingTop(i, node)),
					paddingBottom: i => (i === 0 ? spacing(2) : 0),
					paddingLeft: () => spacing(2),
					paddingRight: () => spacing(2),
					vLineWidth: () => 0,
					hLineWidth: (i: number) => (i <= 1 ? 1 : 0.75),
					hLineColor: (i: number) => (i <= 1 ? colors.black : colors.accent),
					hLineStyle: i => (i <= 1 ? null : { dash: { length: 0.75, space: 1.5 } }),
				},
			},
			{
				marginTop: spacing(6),
				columnGap: spacing(2),
				columns: [
					{
						stack: invoice.config.taxRegistration
							? ['']
							: [...(invoice.tax.map(t => `${t.name} not applicable`) || 'Tax not applicable')],
						color: colors.accent,
						fontSize: fontSize.base,
						marginLeft: spacing(2),
					},
					{
						width: 'auto',
						table: {
							widths: [80, 100],
							body: [
								[
									'Subtotal',
									{
										text: formatCurrency(
											invoice.netTotal,
											invoice.config.currency,
											invoice.config.locale,
										),
										alignment: 'right',
									},
								],
								...invoice.tax.map((tax, i) => [
									{
										text: `${tax.name} incl.`,
										color: colors.accent,
										marginBottom: i === invoice.tax.length - 1 ? spacing(1) : 0,
									},
									{
										text: formatCurrency(
											tax.contribution,
											invoice.config.currency,
											invoice.config.locale,
										),
										alignment: 'right',
										color: colors.accent,
										marginBottom: i === invoice.tax.length - 1 ? spacing(1) : 0,
									},
								]),
								[
									{ text: 'Total', bold: true },
									{
										text: formatCurrency(
											invoice.grossTotal,
											invoice.config.currency,
											invoice.config.locale,
										),
										alignment: 'right',
										bold: true,
										fontSize: fontSize.lg,
										marginTop: spacing(4),
									},
								],
							],
						},
						fontSize: fontSize.base,
						fontFeatures: ['tnum', 'lnum'],
						layout: {
							...BottomLayout,
							paddingBottom: () => spacing(2),
							paddingLeft: () => spacing(2),
							paddingRight: () => spacing(2),
							vLineWidth: () => 0,
							hLineWidth: (i, node) => (i + 1 === node.table.body.length ? 1 : 0),
							hLineColor: () => colors.accent,
						},
					},
				],
			},
		],
		styles: {
			heading: {
				fontSize: fontSize.lg,
				bold: true,
				color: colors.accent,
			},
			footer: {
				fontSize: fontSize.sm,
				color: colors.accent,
			},
		},
	});

	const chunks: Buffer[] = [];

	pdfDoc.on('data', chunk => chunks.push(chunk));
	pdfDoc.end();

	const buffer = await new Promise<Buffer>(resolve => {
		pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
	});

	return new NextResponse(buffer, {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'inline; filename=invoice.pdf',
		},
	});
}
