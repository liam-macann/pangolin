import { Temporal } from 'temporal-polyfill';
import { match } from 'ts-pattern';
import { expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { type Invoice } from './columns';
import { usePlaceholderInvoices } from './placeholder';

type Config = Pick<Invoice['config'], 'timezone' | 'currency' | 'numberingScheme'>;
const defaults: Config = {
	timezone: 'Australia/Sydney',
	currency: 'AUD',
	numberingScheme: 'sequential',
};

async function generate(config?: Partial<Config>) {
	const { result } = await renderHook(() => usePlaceholderInvoices({ ...defaults, ...config }));
	return result.current;
}

test('Generates N unique rows', async () => {
	const invoices = await generate();

	expect(invoices).toHaveLength(5);
	expect(new Set(invoices.map(invoice => invoice.id)).size).toBe(5);
});

test('Forwards the supplied config', async () => {
	const invoices = await generate();
	invoices.map(invoice => expect(invoice.config).toEqual(defaults));
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
