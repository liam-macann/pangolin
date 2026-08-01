import { describe, expect, test } from 'vitest';

import { type Address, formatAddress } from '@/lib/utils/address';

import { type InvoicePrintData } from './index';
import { letterheadTable } from './letterhead';
import { collectTextNodes, invoiceDataBuilder } from './tests/helpers';

describe('letterheadTable', () => {
	const collector = (invoice: InvoicePrintData) => collectTextNodes(letterheadTable(invoice));

	test('Includes header when defined', () => {
		const header = 'ABN 12 345 678 901';

		const withHeader = collector(invoiceDataBuilder({ config: { header } }));
		expect(withHeader).toContainEqual(expect.objectContaining({ text: header }));

		const withoutHeader = collector(invoiceDataBuilder({ config: { header: null } }));
		expect(withoutHeader).not.toContainEqual(expect.objectContaining({ text: header }));
	});

	test('Includes trading number when defined', () => {
		const tradingNumber = ['ABN 12 345 678 901'];

		const withNumber = collector(invoiceDataBuilder({ config: { tradingNumber } }));
		expect(withNumber).toContainEqual(expect.objectContaining({ text: tradingNumber[0] }));

		const withoutNumber = collector(invoiceDataBuilder({ config: { tradingNumber: null } }));
		expect(withoutNumber).not.toContainEqual(expect.objectContaining({ text: tradingNumber[0] }));
	});

	test('Includes email when defined', () => {
		const email = 'billing@acme.example';

		const withEmail = collector(invoiceDataBuilder({ config: { email } }));
		expect(withEmail).toContainEqual(expect.objectContaining({ text: email }));

		const withoutEmail = collector(invoiceDataBuilder({ config: { email: null } }));
		expect(withoutEmail).not.toContainEqual(expect.objectContaining({ text: email }));
	});

	test('Includes phone when defined', () => {
		const phone = '+61 2 5550 1234';

		const withPhone = collector(invoiceDataBuilder({ config: { phone } }));
		expect(withPhone).toContainEqual(expect.objectContaining({ text: phone }));

		const withoutPhone = collector(invoiceDataBuilder({ config: { phone: null } }));
		expect(withoutPhone).not.toContainEqual(expect.objectContaining({ text: phone }));
	});

	test('Includes address when defined', () => {
		const address: Address = {
			streetAddress: ['1 Test St'],
			city: 'Sydney',
			administrativeArea: 'NSW',
			postalCode: '2000',
			country: 'AU',
		};

		// Formatted with real AU locale metadata; sanity-check it reflects the input
		const formattedAddress = formatAddress(address);
		expect(formattedAddress).toContain('1 Test St');

		const withAddress = collector(invoiceDataBuilder({ config: { address } }));
		expect(withAddress).toContainEqual(expect.objectContaining({ text: formattedAddress }));

		const withoutAddress = collector(invoiceDataBuilder({ config: { address: null } }));
		expect(withoutAddress).not.toContainEqual(expect.objectContaining({ text: formattedAddress }));
	});
});
