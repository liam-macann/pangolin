import { assert, describe, expect, test, vi } from 'vitest';

import { formatAddress } from '@/lib/utils/address';

import { buildDocDefinition, type InvoicePrintData } from './index';
import { collectTextNodes, invoiceDataBuilder } from './tests/helpers';

// lib-address uses require() internally which breaks in ESM test environments.
// formatAddress is only called when an address is non-null; stub it so these tests
// don't depend on the real formatting library.
vi.mock('@/lib/utils/address', () => ({
	formatAddress: vi.fn(() => '1 Test St, Sydney NSW 2000, AU'),
	fetchAddressMetadata: vi.fn(),
}));

describe('buildDocDefinition', () => {
	/** Helper to access the footer, with type narrowed according to implementation */
	const getFooter = (invoice: InvoicePrintData) => {
		const { footer } = buildDocDefinition(invoice);

		assert(footer !== undefined, 'Footer should be defined');
		assert(typeof footer === 'function', 'Footer should be a callback function');

		const result = footer(1, 1, { width: 0, height: 0, orientation: 'portrait' });

		assert(result, 'Footer should return content');
		assert(
			typeof result === 'object' && !Array.isArray(result) && result.table,
			'Footer expected to return a table',
		);

		return result;
	};

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

	describe('Bill To', () => {
		test('Includes organization when defined', () => {
			const organization = 'Acme Inc.';

			const collector = (inv: InvoicePrintData) =>
				collectTextNodes(buildDocDefinition(inv).content);

			const toOrg = collector(invoiceDataBuilder({ clientData: { organization } }));
			expect(toOrg).toContainEqual(expect.objectContaining({ text: organization }));

			const toIndividual = collector(invoiceDataBuilder({ clientData: { name: 'Alaric Wivell' } }));
			expect(toIndividual).not.toContainEqual(expect.objectContaining({ text: organization }));
		});

		test('Includes name when defined', () => {
			const name = 'Alaric Wivell';

			const collector = (inv: InvoicePrintData) =>
				collectTextNodes(buildDocDefinition(inv).content);

			const toOrg = collector(invoiceDataBuilder({ clientData: { name } }));
			expect(toOrg).toContainEqual(expect.objectContaining({ text: name }));

			const toIndividual = collector(invoiceDataBuilder({ clientData: { name: null } }));
			expect(toIndividual).not.toContainEqual(expect.objectContaining({ text: name }));
		});

		test('Includes address when defined', () => {
			const address = {
				addressLine1: '1 Test St',
				city: 'Sydney',
				state: 'NSW',
				postalCode: '2000',
				countryCode: 'AU',
			};

			const formattedAddress = '1 Test St, Sydney NSW 2000, AU';
			vi.mocked(formatAddress).mockReturnValue(formattedAddress);

			const collector = (inv: InvoicePrintData) =>
				collectTextNodes(buildDocDefinition(inv).content);

			const withAddress = collector(invoiceDataBuilder({ clientData: { address } }));
			expect(withAddress).toContainEqual(expect.objectContaining({ text: formattedAddress }));

			const withoutAddress = collector(invoiceDataBuilder({ clientData: { address: null } }));
			expect(withoutAddress).not.toContainEqual(
				expect.objectContaining({ text: formattedAddress }),
			);
		});

		test('Prepends "Attn:" to name when organization is set', () => {
			const name = 'Alaric Wivell';

			const collector = (inv: InvoicePrintData) =>
				collectTextNodes(buildDocDefinition(inv).content);

			const toIndividual = collector(invoiceDataBuilder({ clientData: { name } }));

			expect(toIndividual).toContainEqual(expect.objectContaining({ text: name }));
			expect(toIndividual).not.toContainEqual(expect.objectContaining({ text: `Attn: ${name}` }));

			const toOrg = collector(invoiceDataBuilder({ clientData: { name, organization: 'Acme' } }));

			expect(toOrg).toContainEqual(expect.objectContaining({ text: `Attn: ${name}` }));
			expect(toOrg).not.toContainEqual(expect.objectContaining({ text: name }));
		});
	});

	test('Prints payment details when set', () => {
		const paymentDetails = ['BSB 123-456', 'Account 00123456'];

		const collector = (inv: InvoicePrintData) => collectTextNodes(getFooter(inv));

		paymentDetails.forEach(detail => {
			expect(collector(invoiceDataBuilder({ config: { paymentDetails } }))).toContainEqual(
				expect.objectContaining({ text: detail }),
			);

			// Test negative to ensure that matched text is not present elsewhere in document (false positive)
			expect(
				collector(invoiceDataBuilder({ config: { paymentDetails: null } })),
			).not.toContainEqual(expect.objectContaining({ text: detail }));
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
});
