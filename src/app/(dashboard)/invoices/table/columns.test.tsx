import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { type Config } from '@/api/dto/config';
import { type Invoice } from '@/api/dto/invoice';
import { configQueries } from '@/lib/hooks/data/config';
import { NumericString } from '@/lib/utils/numeric';

import { createBuilder } from '@/test/builders';

import { InvoiceTableContent, useInvoiceTable } from './index';

// Row controls bind Server Actions, which can't be loaded in the browser
vi.mock('./components/actions', () => ({ NotesButton: () => null, OverflowMenu: () => null }));
vi.mock('./components/status', () => ({ StatusSelect: () => null }));

/** Builds the current config with optional overrides, merged onto a minimal base. */
const configBuilder = createBuilder<Config>(() => ({
	id: crypto.randomUUID(),
	tradingName: 'Acme Inc.',
	email: null,
	phone: null,
	header: null,
	timezone: 'UTC',
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
}));

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
	client: { name: 'Alaric Wivell', organization: null, id: crypto.randomUUID() },
	timezone: 'Australia/Sydney',
	currency: 'AUD',
	status: 'unpaid',
	notes: null,
	voidedAt: null,
}));

function TestTable({ data }: { data: Invoice[] }) {
	const table = useInvoiceTable({ data }, () => null);

	return (
		<table.AppTable>
			<InvoiceTableContent table={table} />
		</table.AppTable>
	);
}

/** Renders the table with the current config already in the query cache. */
function renderTable(data: Invoice[], config: Partial<Config>) {
	// Seeded data to control what useConfig() hook returns
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
	client.setQueryData(configQueries.current().queryKey, { data: configBuilder(config) });

	return render(
		<QueryClientProvider client={client}>
			<TestTable data={data} />
		</QueryClientProvider>,
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
		const invoice = invoiceBuilder({ issuedAt: '2025-01-15', timezone });
		const screen = await renderTable([invoice], { timezone });

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

describe('Issue date omits the current year of the current config timezone', () => {
	test.for([
		['Australia/Sydney', '1 Jan'],
		['America/New_York', '1 Jan 2027'],
	])('In %s', async ([timezone, expected]) => {
		onTestFinished(() => today.mockRestore());
		const today = vi.spyOn(Temporal.Now, 'plainDateISO').mockImplementation((zone = 'UTC') =>
			// 07:00 on 1 Jan 2027 in Sydney; still 31 Dec 2026 in New York
			Temporal.Instant.from('2026-12-31T20:00:00Z').toZonedDateTimeISO(zone).toPlainDate(),
		);

		const invoice = invoiceBuilder({
			issuedAt: '2027-01-01',
			// The timezone of record is not used to determine the current year
			timezone: 'Pacific/Pago_Pago',
		});
		const screen = await renderTable([invoice], { timezone });

		await page.viewport(2000, 800);
		await expect.element(screen.getByRole('cell', { name: expected, exact: true })).toBeVisible();
	});
});
