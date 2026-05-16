import path from 'node:path';
import { getRegisteredCountries } from 'lib-address';
import { type NextRequest, NextResponse } from 'next/server';
import pdfmake from 'pdfmake';

import { fetchInvoice } from '@/lib/data/invoice';
import { fetchAddressMetadata } from '@/lib/utils/address';

import { getSession } from '@/auth';

import { buildDocDefinition } from './definition';

export async function GET(_request: NextRequest, ctx: RouteContext<'/invoices/[id]'>) {
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

	const pdfDoc = pdfmake.createPdf(buildDocDefinition(invoice));

	return pdfDoc.getBuffer();
}
