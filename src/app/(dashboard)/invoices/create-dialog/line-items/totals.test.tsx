import { FormProvider, useForm } from 'react-hook-form';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { type RenderResult, render } from 'vitest-browser-react';

import { invoiceItemBuilder } from '@/lib/actions/tests/builders';

import { LineItemsField } from './index';
import { type LineItemsConfig, type LineItemsFormValues } from './types';

const gst = { id: crypto.randomUUID(), name: 'GST', rate: '0.1000' } as const;
const vat = { id: crypto.randomUUID(), name: 'VAT', rate: '0.2000' } as const;

const config: LineItemsConfig = {
	currency: 'AUD',
	locale: 'en-AU',
	taxRegistration: true,
	taxes: [gst, vat],
};

function TestForm({ items }: { items: LineItemsFormValues['items'] }) {
	const form = useForm<LineItemsFormValues>({ defaultValues: { items } });
	return (
		<FormProvider {...form}>
			<LineItemsField config={config} />
		</FormProvider>
	);
}

const locators = (screen: RenderResult) => ({
	subtotal: screen.getByRole('row', { name: /^Subtotal/ }),
	total: screen.getByRole('row', { name: /^Total/ }),
});

test('Calculates totals across locale-formatted inputs', async () => {
	const screen = await render(
		<TestForm
			items={[
				invoiceItemBuilder({ quantity: '2', unitCost: '10.50', taxes: new Set([gst.id]) }),
				invoiceItemBuilder({ quantity: '1,5', unitCost: '20', taxes: new Set([vat.id, gst.id]) }),
				invoiceItemBuilder({ quantity: '1.1', unitCost: '1,500.01', taxes: new Set([vat.id]) }),
				invoiceItemBuilder({ quantity: '1,200.1', unitCost: '1,5', taxes: new Set([vat.id]) }),
			]}
		/>,
	);

	await expect
		.element(screen.getByRole('row', { name: /^Subtotal/ }))
		.toHaveTextContent('$3,501.16');

	await expect.element(screen.getByRole('row', { name: /^Total/ })).toHaveTextContent('$4,202.29');
});

test('Updates figures when inputs and selected taxes change', async () => {
	const screen = await render(
		<TestForm items={[invoiceItemBuilder({ quantity: '1', unitCost: '10' })]} />,
	);

	const quantity = screen.getByRole('textbox', { name: 'Quantity' });
	const unitCost = screen.getByRole('textbox', { name: 'Each' });

	const output = locators(screen);

	// Displayed on mount
	await expect.element(output.subtotal).toHaveTextContent('$10.00');
	await expect.element(output.total).toHaveTextContent('$10.00');

	await quantity.clear();
	await userEvent.type(quantity, '1,5');
	await unitCost.clear();
	await userEvent.type(unitCost, '20');

	// Displayed after input change
	await expect.element(output.subtotal).toHaveTextContent('$30.00');
	await expect.element(output.total).toHaveTextContent('$30.00');

	await screen.getByRole('button', { name: 'Actions' }).click();
	await screen.getByRole('menuitemcheckbox', { name: /GST/ }).click();

	// Displayed after tax change
	await expect.element(output.subtotal).toHaveTextContent('$30.00');
	await expect.element(output.total).toHaveTextContent('$33.00');
});

test('Ignores incomplete values', async () => {
	const screen = await render(
		<TestForm
			items={[
				invoiceItemBuilder({ quantity: '', unitCost: '100', taxes: new Set([gst.id]) }),
				invoiceItemBuilder({ quantity: '1', unitCost: '2', taxes: new Set() }),
			]}
		/>,
	);

	const output = locators(screen);
	await expect.element(output.subtotal).toHaveTextContent('$2');
	await expect.element(output.total).toHaveTextContent('$2');
});

test('Calculates negative line totals', async () => {
	const screen = await render(
		<TestForm
			items={[
				invoiceItemBuilder({ quantity: '1', unitCost: '1', taxes: new Set() }),
				invoiceItemBuilder({ quantity: '1', unitCost: '-5.5', taxes: new Set() }),
			]}
		/>,
	);

	const output = locators(screen);
	await expect.element(output.subtotal).toHaveTextContent('-$4.50');
	await expect.element(output.total).toHaveTextContent('-$4.50');
});
