import { NextResponse } from 'next/server'; // For App Router
import path from 'path';
import PDFDocument from 'pdfkit';
import { fetchInvoice } from '@/lib/data';

const colors = {
	black: '#000000',
	muted: '#999',
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

	const fontPath = path.resolve('./public/InstrumentSans-Regular.ttf');
	const doc = new PDFDocument({
		font: fontPath,
		size: 'A4',
		margins: {
			top: '50',
			right: '70',
			bottom: '110',
			left: '70',
		},
	});
	const chunks: Buffer[] = [];

	const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

	// Collect PDF chunks in memory
	doc.on('data', chunk => chunks.push(chunk));
	doc.on('end', () => {});

	doc.registerFont('bold', './public/InstrumentSans-Semibold.ttf');
	doc.registerFont('regular', './public/InstrumentSans-Regular.ttf');

	doc.fontSize(fontSize.sm).fill(colors.muted);
	doc.text(invoice.user.name, { align: 'right' }).moveDown();
	doc.text('ABN 00 000 000 000', { align: 'right' });
	doc.text(invoice.user.email, { align: 'right' });
	doc.moveDown(2);

	// Footer

	function footer() {
		if (!invoice) throw new Error('Invoice not found');

		const pos = [doc.x, doc.y];
		const margin = doc.page.margins.bottom;
		doc.save();

		// 1. DEFINE THE TARGET BOTTOM LINE
		doc.page.margins.bottom = 0;
		const bottomAlignY = doc.page.height - doc.page.margins.top;

		// Uncomment: Reference line
		// doc
		// 	.strokeColor('red')
		// 	.moveTo(doc.page.margins.left, bottomAlignY)
		// 	.lineTo(doc.page.width - doc.page.margins.right, bottomAlignY)
		// 	.stroke();
		// doc.fillColor('black');

		// Define the text and its options
		const gutter = 8;
		const textOptions: PDFKit.Mixins.TextOptions = {
			width: width / 2 - gutter,
			align: 'left',
		};

		doc.fontSize(fontSize.sm).fill(colors.muted);

		const leftText = `This is a block of text that might wrap to multiple lines. We want its very last line to sit perfectly on the red line.`;
		const leftHeight = doc.heightOfString(leftText, textOptions);
		doc.text(leftText, doc.page.margins.left, bottomAlignY - leftHeight, textOptions);

		const rightText = `Issued ${invoice.issuedAt}`;
		const rightHeight = doc.heightOfString(rightText, textOptions);
		doc.text(rightText, doc.page.width / 2 + gutter, bottomAlignY - rightHeight, {
			...textOptions,
			align: 'right',
		});

		doc.fontSize(fontSize.base).fillColor(colors.black);
		doc.restore();

		doc.x = pos[0];
		doc.y = pos[1];
		doc.page.margins.bottom = margin;
	}

	footer();
	doc.on('pageAdded', footer);

	//
	//
	//
	//  Content start

	doc.fontSize(fontSize.lg).fill(colors.black);

	// Title
	doc.text(`Invoice INV-${invoice.index.toString().padStart(3, '0')}`);

	doc.fontSize(fontSize.base);
	doc.save();

	doc.moveDown(2);

	// Enclosed rect
	const pos = doc.y;

	doc.font('bold').text(`Title will go here`, {
		// width: 410,
		align: 'left',
	});

	doc.moveUp();
	doc.text(`Due date`, {
		// width: 410,
		align: 'right',
	});

	doc.moveDown();
	doc.text(`Bill To`, {
		// width: 410,
		align: 'left',
	});
	doc.font('regular').text(invoice.client.name, {
		// width: 410,
		align: 'left',
	});

	// draw bounding rectangle
	const padding = spacing[2];
	doc
		.rect(doc.x - padding, pos - padding, width + padding * 2, doc.y - pos + padding * 2)
		.fillOpacity(0.08)
		.fill('black')
		.moveDown(2);

	doc.restore();

	// Invoice items
	doc
		.font('bold')
		.fontSize(fontSize.base)
		.table({
			rowStyles: i => {
				return {
					...(i < 1
						? // Header
							{ border: [1, 0, 1, 0] }
						: // Body
							{ border: [0, 0, 0.5, 0], borderColor: colors.muted }),
				};
			},
			columnStyles: i => {
				return {
					...(i < 1
						? // Description
							{ align: { x: 'left', y: 'center' }, padding: [spacing[1], spacing[1]] }
						: // Numerals
							{
								align: { x: 'right', y: 'center' },
								width: 90,
								padding: [spacing[3], spacing[1]],
							}),
					...{},
				};
			},
			data: [
				['Description', 'Quantity', 'Each', 'Amount'],
				...(invoice.items?.map(item => {
					// console.log(item);
					return [
						{ text: item.note ? `${item.label}\n${item.note}` : item.label },
						{ text: `${item.quantity} ${item.unit ?? ''}`.trim(), font: { src: 'regular' } },
						{ text: `$${item.unitCost}`, font: { src: 'regular' } },
						{ text: `$${item.amount}` },
					];
				}) || []),
			],
		});

	doc.end();

	const buffer = await new Promise<Buffer>(resolve => {
		doc.on('end', () => resolve(Buffer.concat(chunks)));
	});

	return new NextResponse(buffer, {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'inline; filename=test.pdf',
		},
	});
}
