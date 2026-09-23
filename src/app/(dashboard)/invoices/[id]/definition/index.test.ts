import { assert, describe, expect, test } from 'vitest';

import { buildDocDefinition, type InvoicePrintData } from './index';
import { collectTextNodes, invoiceDataBuilder, renderText } from './tests/helpers';

describe('buildDocDefinition', () => {
	describe('VOID watermark', () => {
		test('Active invoice has no watermark', () => {
			const inv = invoiceDataBuilder({ status: { isVoid: false } });
			expect(buildDocDefinition(inv).watermark).toBeUndefined();
		});

		test('Voided invoice has watermark', () => {
			const inv = invoiceDataBuilder({ status: { isVoid: true } });
			expect(buildDocDefinition(inv).watermark).toMatchObject({ text: 'VOID' });
		});
	});

	describe('Document metadata', () => {
		test('Document title includes the invoice reference number', () => {
			const inv = invoiceDataBuilder({ reference: 'INV-002' });
			expect(buildDocDefinition(inv).info?.title).toContain(inv.reference);
		});

		test('Author is set to trading name', () => {
			const inv = invoiceDataBuilder({ config: { tradingName: 'Acme Inc.' } });
			expect(buildDocDefinition(inv).info?.author).toBe(inv.config.tradingName);
		});

		describe('Tax registration status', () => {
			test('Title uses plain "Invoice" prefix without tax registration', () => {
				const { info } = buildDocDefinition(
					invoiceDataBuilder({ config: { taxRegistration: false } }),
				);
				expect(info?.title).toMatch(/^Invoice /);
				expect(info?.title).not.toContain(/\btax\b/i);
			});

			test('Title uses "Tax Invoice" prefix when tax-registered', () => {
				const { info } = buildDocDefinition(
					invoiceDataBuilder({ config: { taxRegistration: true } }),
				);
				expect(info?.title).toMatch(/^Tax Invoice /);
			});
		});
	});

	test('Prints a description when set', () => {
		const description = 'Services rendered per SOW-2025-001';

		const collector = (inv: InvoicePrintData) => collectTextNodes(buildDocDefinition(inv).content);

		expect(collector(invoiceDataBuilder({ description: description }))).toContainEqual(
			expect.objectContaining({ text: description }),
		);

		// Test negative to ensure that matched text is not present elsewhere in document (false positive)
		expect(collector(invoiceDataBuilder())).not.toContainEqual(
			expect.objectContaining({ text: description }),
		);
	});

	describe('Document heading', () => {
		// content[1] is the heading node; see the `content:` array in buildDocDefinition()
		const getHeading = (invoice: InvoicePrintData) => {
			const { content } = buildDocDefinition(invoice);

			assert(Array.isArray(content), 'Expected content to be an array of nodes');
			const heading = content[1];

			assert(
				typeof heading === 'object' && !Array.isArray(heading) && 'style' in heading,
				'Expected content[1] to be the heading node',
			);

			return heading;
		};

		test('Reference without a hyphen renders the title as plain text', () => {
			const heading = getHeading(invoiceDataBuilder({ reference: 'INV001' }));
			expect(heading.text).toBe('Invoice INV001');
		});

		// Adds optical spacing around a hyphen in the reference number, without affecting copy/paste
		test('Reference with a hyphen applies extra spacing around it', () => {
			const heading = getHeading(invoiceDataBuilder({ reference: 'INV-001' }));

			assert(Array.isArray(heading.text), 'Expected title to be split around the hyphen');
			expect(heading.text).toHaveLength(3);

			expect(typeof heading.text[0]).toBe('string');
			expect(heading.text[1]).toHaveProperty('characterSpacing');
			expect(typeof heading.text[2]).toBe('string');

			expect(renderText(heading)).toBe('Invoice INV-001');
		});
	});

	describe('Document footer', () => {
		test('Page bottom margin grows with additional payment detail lines', () => {
			const bottomMarginOf = (paymentDetails: string[]) => {
				const margins = buildDocDefinition(
					invoiceDataBuilder({ config: { paymentDetails } }),
				).pageMargins;

				assert(margins !== undefined, 'pageMargins should be defined');

				// Margins may be:
				if (Array.isArray(margins)) {
					// - a tuple of two values `[horizontal, vertical]`
					// - a tuple of four values `[left, top, right, bottom]`
					if (margins.length === 2) return margins[1];
					if (margins.length === 4) return margins[3];
				}

				// - a single number which applies the same margin on all sides
				return margins;
			};

			expect(bottomMarginOf(['1'])).toBeLessThan(bottomMarginOf(['1', '2', '3', '4', '5']));
		});
	});

	// Invoices must render identically given the same input.
	// A snapshot catches any unintended structural or styling drift across the whole document
	test('Produces a stable document for a representative invoice', () => {
		const invoice = invoiceDataBuilder({
			reference: '2025-014',
			title: 'Website redesign',
			description: 'Milestone 2 of 3 — see SOW-2025-014 for full scope',
			config: {
				tradingName: 'Acme Design Co.',
				email: 'billing@acme.example',
				phone: '+61 2 5550 1234',
				header: 'ABN 12 345 678 901',
				taxRegistration: true,
				paymentDetails: ['BSB 123-456', 'Account 00123456'],
				colorScheme: 'grass',
				address: {
					streetAddress: ['1 Example St'],
					city: 'Sydney',
					administrativeArea: 'NSW',
					postalCode: '2000',
					country: 'AU',
				},
			},
			clientData: {
				name: 'Alaric Wivell',
				organization: 'Wivell Holdings',
				address: {
					streetAddress: ['2 Sample Ave'],
					city: 'Melbourne',
					administrativeArea: 'VIC',
					postalCode: '3000',
					country: 'AU',
				},
			},
			items: [
				{
					label: 'Design consultation',
					note: 'Includes two revision rounds',
					quantity: '5.00',
					unit: 'hours',
					unitCost: '150.0000',
					netAmount: '750.0000',
					taxes: [{ name: 'GST', rate: '0.1000' }],
				},
				{
					label: 'Stock imagery licence',
					quantity: '3.00',
					unit: 'items',
					unitCost: '40.0000',
					netAmount: '120.0000',
					taxes: [],
				},
			],
			tax: [{ name: 'GST', contribution: '75.0000' }],
			netTotal: 870,
			grossTotal: 945,
		});

		const { footer, ...definition } = buildDocDefinition(invoice);
		assert(typeof footer === 'function', 'Expected footer to be a callback function');

		// Footer is a callback pdfmake invokes at render time.
		// Call it here so rendered content (incl. payment details, issued date) is captured too.
		expect({
			...definition,
			footer: footer(1, 1, { width: 0, height: 0, orientation: 'portrait' }),
		}).toMatchSnapshot();
	});
});
