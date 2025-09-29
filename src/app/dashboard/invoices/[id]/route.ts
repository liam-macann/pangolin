import fs from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';
import PdfPrinter from 'pdfmake';
import { fetchInvoice } from '@/lib/data';

import { BottomLayout, CenteredLayout } from '@/lib/pdf-verticalalign';

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

const spacing: Record<number, number> = {
	1: px(8),
	2: px(12),
	3: px(16),
	4: px(24),
	5: px(32),
	6: px(48),
};

export async function GET(request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const invoice = await fetchInvoice(id);

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

	const pageMargins: [number, number, number, number] = [50, 50, 50, 70];

	const pdfDoc = printer.createPdfKitDocument({
		pageSize: 'A4',
		pageMargins,
		info: {
			title: 'Invoice',
			// author: 'john doe',
			creator: 'Invoicer',
			producer: 'Invoicer',
			creationDate: invoice.issuedAt,
			modDate: invoice.issuedAt,
		},
		footer: (_currentPage, _pageCount) => {
			return {
				style: 'footer',
				margin: [pageMargins[0], 0, pageMargins[2], 0],
				layout: {
					...BottomLayout,
					hLineWidth: () => 0,
					vLineWidth: () => 0,
					paddingBottom: () => 0,
					paddingLeft: i => (i === 0 ? 0 : 5),
					paddingRight: i => (i > 0 ? 0 : 5),
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
								text: `Issued ${invoice.issuedAt}`,
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
						text: invoice.user.name,
						bold: true,
						color: colors.heavy,
						margin: [0, 0, 0, spacing[3]],
					},
					{ text: 'ABN 00 000 000 000' },
					{ text: invoice.user.email },
				],
			},
			{
				text: `Invoice INV-${invoice.index.toString().padStart(3, '0')}`,
				style: 'header',
				marginLeft: spacing[4],
			},
			{
				table: {
					widths: ['*', '30%'],
					body: [
						[
							{ text: 'Invoice title', bold: true },
							{ width: '30%', text: 'Due date', alignment: 'right', bold: true },
						],
						[{ stack: [{ text: 'Bill To', bold: true }, invoice.client.name], colSpan: 2 }],
					],
				},
				fontSize: fontSize.base,
				margin: [0, spacing[5]],
				layout: {
					fillColor: colors.gray,
					paddingTop: i => (i === 0 ? spacing[4] : 0),
					paddingBottom: () => spacing[4],
					paddingLeft: () => spacing[4],
					paddingRight: () => spacing[4],
					hLineWidth: () => 0,
					vLineWidth: () => 0,
				},
			},
			{
				stack: [
					{
						table: {
							headerRows: 1,
							widths: ['*', 80, 80, 80],
							body: [
								[{ text: 'Description', alignment: 'left' }, 'Quantity', 'Each', 'Amount'],
								...(invoice.items?.map(item => [
									{
										stack: [
											{ text: item.label },
											{ text: item.note, color: colors.accent, bold: false },
										],
										alignment: 'left',
										margin: [0, spacing[1]],
									},
									{ text: `${item.quantity} ${item.unit ?? ''}`.trim(), bold: false },
									{ text: `$${item.unitCost}`, bold: false },
									{ text: `$${item.amount}`, margin: [0, spacing[3]] },
								]) || []),
							],
						},
						bold: true,
						alignment: 'right',
						fontSize: fontSize.base,
						layout: {
							...CenteredLayout,
							paddingTop: (i, node) =>
								i === 0 ? spacing[1] : CenteredLayout.paddingTop?.(i, node) || 0,
							paddingBottom: i => (i === 0 ? spacing[1] : 0),
							vLineWidth: () => 0,
							hLineWidth: (i: number) => (i <= 1 ? 1 : 0.75),
							hLineColor: (i: number) => (i <= 1 ? colors.black : colors.accent),
							hLineStyle: i => {
								if (i <= 1) {
									return null;
								}
								return { dash: { length: 0.75, space: 1.5 } };
							},
						},
					},
				],
			},
		],
		styles: {
			header: {
				fontSize: fontSize.lg,
				bold: true,
				margin: [0, spacing[6], 0, spacing[2]],
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
