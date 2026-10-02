import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { type Invoice } from '@/api/dto/invoice';
import { NumericString } from '@/lib/utils/numeric';

import { createBuilder } from '@/test/builders';

import { InvoiceTableContent, LocaleContext, useInvoiceTable } from './index';

// Row controls bind Server Actions, which can't be loaded in the browser
vi.mock('./components/actions', () => ({ NotesButton: () => null, OverflowMenu: () => null }));
vi.mock('./components/status', () => ({ StatusSelect: () => null }));

/** Builds an invoice with optional overrides, merged onto a minimal base. */
const invoiceBuilder = createBuilder<Invoice>(() => ({
	id: crypto.randomUUID(),
	issuedAt: '2025-01-15',
	dueAt: '2025-02-15',
	partition: null,
	index: 1,
	title: null,
	description: null,
	createdAt: '2025-01-15T00:00:00.000Z',
	netTotal: NumericString.parse('1000.0000'),
	grossTotal: NumericString.parse('1000.0000'),
	reference: 'INV-001',
	clientData: { name: 'Alaric Wivell', organization: null, clientId: crypto.randomUUID() },
	config: { timezone: 'Australia/Sydney', currency: 'AUD', numberingScheme: 'sequential' },
	status: { status: 'unpaid', notes: null, isVoid: false },
}));

function TestTable({ data }: { data: Invoice[] }) {
	const table = useInvoiceTable({ data }, () => null);

	return (
		<LocaleContext value='en-AU'>
			<table.AppTable>
				<InvoiceTableContent table={table} />
			</table.AppTable>
		</LocaleContext>
	);
}

describe('Issue date prints the stored calendar date', () => {
	test.for([
		'UTC',
		'Pacific/Pago_Pago',
		'America/New_York',
		'Africa/Abidjan',
		'Australia/Sydney',
		'Pacific/Kiritimati',
		'Asia/Kathmandu',
	])('In %s', async timezone => {
		// Database stores calendar date in configured timezone
		// This should never be interpreted as an instant, or cast between zones
		const invoice = invoiceBuilder({ issuedAt: '2025-01-15', config: { timezone } });
		const screen = await render(<TestTable data={[invoice]} />);

		await page.viewport(2000, 800);
		await expect
			.element(screen.getByRole('cell', { name: '15 Jan 2025', exact: true }))
			.toBeVisible();

		// On mobile breakpoint the Date column is hidden, and the Name cell prints the date instead
		await page.viewport(200, 800);
		await expect
			.element(screen.getByRole('cell', { name: /^Alaric Wivell/ }))
			.toHaveTextContent('15 Jan 2025');
	});
});
