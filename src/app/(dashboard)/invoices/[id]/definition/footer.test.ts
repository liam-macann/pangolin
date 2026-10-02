import { assert, describe, expect, test } from 'vitest';

import { documentFooter } from './footer';
import { type InvoicePrintData } from './index';
import { collectTextNodes, invoiceDataBuilder, renderText } from './tests/helpers';

describe('documentFooter', () => {
	const render = (
		invoice: InvoicePrintData,
		// Page margins only affect layout/padding, not the content asserted below
		margins: [number, number, number, number] = [0, 0, 0, 0],
	) => {
		const result = documentFooter(invoice, margins)(1, 1, {
			width: 0,
			height: 0,
			orientation: 'portrait',
		});

		assert(result, 'Footer should return content');
		assert(
			typeof result === 'object' && !Array.isArray(result) && result.table,
			'Footer expected to return a table',
		);

		return result;
	};

	test('Prints payment details when set', () => {
		const paymentDetails = ['BSB 123-456', 'Account 00123456'];

		paymentDetails.forEach(detail => {
			expect(
				collectTextNodes(render(invoiceDataBuilder({ config: { paymentDetails } }))),
			).toContainEqual(expect.objectContaining({ text: detail }));

			// Test negative to ensure that matched text is not present elsewhere in document (false positive)
			expect(
				collectTextNodes(render(invoiceDataBuilder({ config: { paymentDetails: null } }))),
			).not.toContainEqual(expect.objectContaining({ text: detail }));
		});
	});

	test('Issued date renders using the invoice timezone and locale', () => {
		const invoice = invoiceDataBuilder({
			issuedAt: '2025-06-01',
			config: { timezone: 'Pacific/Auckland', locale: 'de' },
		});

		const issuedCell = render(invoice).table.body[0][2];

		expect(renderText(issuedCell)).toBe('Issued 1. Juni 2025');
	});

	describe('Issued date prints the stored calendar date', () => {
		test.for([
			'UTC',
			'Pacific/Pago_Pago',
			'America/New_York',
			'Africa/Abidjan',
			'Australia/Sydney',
			'Pacific/Kiritimati',
			'Asia/Kathmandu',
		])('In %s', timezone => {
			// Database stores calendar date in configured timezone
			// This should never be interpreted as an instant, or cast between zones
			const invoice = invoiceDataBuilder({ issuedAt: '2026-01-01', config: { timezone } });

			expect(renderText(render(invoice).table.body[0][2])).toBe('Issued 1 Jan 2026');
		});
	});

	test('Horizontal margins match page margins so the footer aligns with body content', () => {
		// Left and right must be distinct values, so a swapped index would fail this
		expect(render(invoiceDataBuilder(), [40, 20, 60, 80]).margin).toEqual([40, 0, 60, 0]);
	});

	test('Column padding creates a gutter only between columns, not at the outer edges', () => {
		const footer = render(invoiceDataBuilder());
		const { layout, table } = footer;

		assert(
			typeof layout === 'object' && layout.paddingLeft && layout.paddingRight,
			'Expected paddingLeft/paddingRight layout callbacks',
		);

		const lastColumn = table.body[0].length - 1;

		expect(layout.paddingLeft(0, footer)).toBe(0);
		expect(layout.paddingLeft(lastColumn, footer)).not.toBe(0);

		expect(layout.paddingRight(0, footer)).not.toBe(0);
		expect(layout.paddingRight(lastColumn, footer)).toBe(0);
	});
});
