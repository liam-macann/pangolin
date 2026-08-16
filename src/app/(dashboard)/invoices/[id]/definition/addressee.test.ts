import { describe, expect, test } from 'vitest';

import { type Address } from '@/api/dto/address';
import { formatAddress } from '@/lib/utils/address';

import { addresseeTable } from './addressee';
import { type InvoicePrintData } from './index';
import { collectTextNodes, invoiceDataBuilder } from './tests/helpers';

describe('addresseeTable', () => {
	const collector = (invoice: InvoicePrintData) => collectTextNodes(addresseeTable(invoice));

	test('Includes title when defined', () => {
		const title = 'Website redesign';

		const withTitle = collector(invoiceDataBuilder({ title }));
		expect(withTitle).toContainEqual(expect.objectContaining({ text: title }));

		const withoutTitle = collector(invoiceDataBuilder({ title: null }));
		expect(withoutTitle).not.toContainEqual(expect.objectContaining({ text: title }));
	});

	test('Includes organization when defined', () => {
		const organization = 'Acme Inc.';

		const toOrg = collector(invoiceDataBuilder({ clientData: { organization } }));
		expect(toOrg).toContainEqual(expect.objectContaining({ text: organization }));

		const toIndividual = collector(invoiceDataBuilder({ clientData: { name: 'Alaric Wivell' } }));
		expect(toIndividual).not.toContainEqual(expect.objectContaining({ text: organization }));
	});

	test('Includes name when defined', () => {
		const name = 'Alaric Wivell';

		const toOrg = collector(invoiceDataBuilder({ clientData: { name } }));
		expect(toOrg).toContainEqual(expect.objectContaining({ text: name }));

		const toIndividual = collector(invoiceDataBuilder({ clientData: { name: null } }));
		expect(toIndividual).not.toContainEqual(expect.objectContaining({ text: name }));
	});

	test('Includes address when defined', () => {
		const address: Address = {
			streetAddress: ['1 Test St'],
			dependentLocality: null,
			city: 'Sydney',
			administrativeArea: 'NSW',
			postalCode: '2000',
			sortingCode: null,
			country: 'AU',
		};

		// Formatted with real AU locale metadata; sanity-check it reflects the input
		const formattedAddress = formatAddress(address);
		expect(formattedAddress).toContain('1 Test St');

		const withAddress = collector(invoiceDataBuilder({ clientData: { address } }));
		expect(withAddress).toContainEqual(expect.objectContaining({ text: formattedAddress }));

		const withoutAddress = collector(invoiceDataBuilder({ clientData: { address: null } }));
		expect(withoutAddress).not.toContainEqual(expect.objectContaining({ text: formattedAddress }));
	});

	test('Prepends "Attn:" to name when organization is set', () => {
		const name = 'Alaric Wivell';

		const toIndividual = collector(invoiceDataBuilder({ clientData: { name } }));
		expect(toIndividual).toContainEqual(expect.objectContaining({ text: name }));
		expect(toIndividual).not.toContainEqual(expect.objectContaining({ text: `Attn: ${name}` }));

		const toOrg = collector(invoiceDataBuilder({ clientData: { name, organization: 'Acme' } }));
		expect(toOrg).toContainEqual(expect.objectContaining({ text: `Attn: ${name}` }));
		expect(toOrg).not.toContainEqual(expect.objectContaining({ text: name }));
	});
});
