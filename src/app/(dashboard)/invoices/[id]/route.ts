import path from 'node:path';
import { getRegisteredCountries } from 'lib-address';
import { unauthorized, unstable_rethrow } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';
import pdfmake from 'pdfmake';
import z from 'zod/v4';

import { fetchInvoice } from '@/lib/data/invoice';
import { fetchAddressMetadata } from '@/lib/utils/address';

import { getSession } from '@/auth';

import { buildDocDefinition } from './definition';

const ALLOWED_PDF_HOSTS = new Set(
	[
		process.env.VERCEL_URL,
		process.env.VERCEL_BRANCH_URL,
		process.env.VERCEL_PROJECT_PRODUCTION_URL,
		process.env.BETTER_AUTH_URL,
	].filter((v): v is string => Boolean(v)),
);

pdfmake.setUrlAccessPolicy(url => {
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'https:' && ALLOWED_PDF_HOSTS.has(parsed.hostname);
	} catch {
		return false;
	}
});

pdfmake.setLocalAccessPolicy(p => path.resolve(p).startsWith(path.resolve('./src/fonts')));

pdfmake.addFonts({
	InstrumentSans: {
		normal: path.resolve('./src/fonts/InstrumentSans+Noto-Regular.ttf'),
		bold: path.resolve('./src/fonts/InstrumentSans+Noto-Semibold.ttf'),
	},
});

export async function GET(_request: NextRequest, ctx: RouteContext<'/invoices/[id]'>) {
	const { id: invoiceId } = await ctx.params;
	if (!z.uuid().safeParse(invoiceId).success) {
		return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
	}

	const session = await getSession();
	if (!session) return unauthorized();

	let buffer: Buffer;
	try {
		buffer = await generatePdf(invoiceId);
	} catch (err) {
		unstable_rethrow(err);
		console.error('Invoice pdf generation failed', { invoiceId, err });
		return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 });
	}

	return new NextResponse(new Uint8Array(buffer), {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'inline; filename=invoice.pdf',
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff',
		},
	});
}

async function generatePdf(invoiceId: string) {
	const invoice = await fetchInvoice(invoiceId);

	const registered = getRegisteredCountries().map(c => c.value);

	// At build, all countries should be registered. During dev, fetch metadata for any non-registered country.
	if (invoice.config.address?.country && !registered.includes(invoice.config.address.country)) {
		await fetchAddressMetadata(invoice.config.address.country);
	}

	const pdfDoc = pdfmake.createPdf(buildDocDefinition(invoice));
	return pdfDoc.getBuffer();
}
