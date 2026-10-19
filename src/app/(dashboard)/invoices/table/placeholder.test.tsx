import { Temporal } from 'temporal-polyfill';
import { match } from 'ts-pattern';
import { expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import type * as DTO from '@/api/dto/config';

import { usePlaceholderInvoices } from './placeholder';

type Config = Pick<DTO.Config, 'timezone' | 'currency' | 'numberingScheme'>;
const defaults: Config = {
	timezone: 'Australia/Sydney',
	currency: 'AUD',
	numberingScheme: 'sequential',
};

async function generate(config?: Partial<Config>, count?: number) {
	const { result } = await renderHook(() =>
		usePlaceholderInvoices({ ...defaults, ...config }, count),
	);
	return result.current;
}

test('Generates N unique rows', async () => {
	const invoices = await generate(undefined, 6);

	expect(invoices).toHaveLength(6);
	expect(new Set(invoices.map(invoice => invoice.id)).size).toBe(6);
});

test('Forwards the invoice config fields', async () => {
	const [invoice] = await generate(undefined, 1);

	expect(invoice.timezone).toBe(defaults.timezone);
	expect(invoice.currency).toBe(defaults.currency);
});

test.for(['sequential', 'annual'] as const)(
	'Generates unique references in %s format',
	async numberingScheme => {
		const invoices = await generate({ numberingScheme });

		expect(new Set(invoices.map(invoice => invoice.reference)).size).toBe(invoices.length);

		invoices.map(({ reference }) =>
			match(numberingScheme)
				.with('annual', () => expect(reference).toMatch(/^\d{4}-\d+$/))
				.with('sequential', () => expect(reference).toMatch(/^INV-\d+$/)),
		);
	},
);

test('Generates valid dates', async () => {
	const invoices = await generate();

	invoices.forEach(invoice => {
		expect(Temporal.PlainDate.compare(invoice.dueAt, invoice.issuedAt)).toBe(1);
		expect(Number.isFinite(Date.parse(invoice.createdAt))).toBe(true);
	});
});

test('Generates positive totals', async () => {
	const invoices = await generate();

	invoices.forEach(invoice => {
		expect(Number(invoice.netTotal)).toBeGreaterThan(0);
		expect(Number(invoice.grossTotal)).toBeGreaterThanOrEqual(Number(invoice.netTotal));
	});
});
