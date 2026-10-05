import { zodResolver } from '@hookform/resolvers/zod';
import { MotionGlobalConfig } from 'motion/react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type z from 'zod/v4';

import { invoiceItemBuilder } from '@/lib/actions/tests/builders';
import { document } from '@/lib/validation/document';

import { LineItemsField } from './index';
import { type LineItemsConfig, type LineItemsFormValues } from './types';

const gst = { id: crypto.randomUUID(), name: 'GST', rate: '0.1000' } as const;
const vat = { id: crypto.randomUUID(), name: 'VAT', rate: '0.2000' } as const;

const defaultConfig: LineItemsConfig = {
	currency: 'AUD',
	locale: 'en-AU',
	taxRegistration: true,
	taxes: [gst, vat],
};

const itemA = invoiceItemBuilder({
	label: 'Removed item',
	quantity: '1',
	taxes: new Set([gst.id]),
});

const itemB = invoiceItemBuilder({
	label: 'Surviving item',
	quantity: '2',
	taxes: new Set([vat.id]),
});

const lineItemsSchema = document.pick({ items: true });

/** The submitted payload for these items, as produced by the schema. */
const parser = (items: LineItemsFormValues['items']) => lineItemsSchema.parse({ items });

beforeEach(() => {
	MotionGlobalConfig.skipAnimations = true;
});

afterEach(() => {
	MotionGlobalConfig.skipAnimations = false;
});

function TestForm({
	onSubmit = () => {},
	items = [itemA, itemB],
	config = defaultConfig,
}: {
	onSubmit?: (values: z.output<typeof lineItemsSchema>) => void;
	items?: LineItemsFormValues['items'];
	config?: LineItemsConfig;
}) {
	const { control, getValues, handleSubmit } = useForm({
		resolver: zodResolver(lineItemsSchema),
		defaultValues: { items },
	});

	return (
		<form onSubmit={handleSubmit(values => onSubmit(values))}>
			<LineItemsField control={control} getValues={getValues} config={config} />
			<button type='submit'>Submit</button>
		</form>
	);
}

describe('Excludes a deleted row from submission', () => {
	test('During exit animation', async () => {
		MotionGlobalConfig.skipAnimations = false;

		const onSubmit = vi.fn();
		const screen = await render(<TestForm onSubmit={onSubmit} />);

		await screen.getByRole('button', { name: 'Actions' }).first().click();
		await screen.getByRole('menuitem', { name: 'Delete' }).click();
		await screen.getByRole('button', { name: 'Submit' }).click({ force: true });

		await expect.poll(() => onSubmit).toHaveBeenCalledWith(parser([itemB]));
	});

	test('After exit animation', async () => {
		const onSubmit = vi.fn();
		const screen = await render(<TestForm onSubmit={onSubmit} />);
		const removedRow = screen.getByRole('listitem', { name: 'Item 1' }).element();

		await screen.getByRole('button', { name: 'Actions' }).first().click();
		await screen.getByRole('menuitem', { name: 'Delete' }).click();
		await expect.poll(() => removedRow.isConnected).toBe(false);
		await screen.getByRole('button', { name: 'Submit' }).click();

		expect(onSubmit).toHaveBeenCalledWith(parser([itemB]));
	});

	test('Does not retain the last row after deletion', async () => {
		MotionGlobalConfig.skipAnimations = false;

		const onSubmit = vi.fn();
		const screen = await render(<TestForm items={[itemA]} onSubmit={onSubmit} />);
		const removedRow = screen.getByRole('listitem', { name: 'Item 1' }).element();
		const emptyError = screen.getByRole('alert', { hasText: 'Invoice must contain items' });

		await expect.element(emptyError).not.toBeInTheDocument();

		await screen.getByRole('button', { name: 'Actions' }).first().click();
		await screen.getByRole('menuitem', { name: 'Delete' }).click();
		await screen.getByRole('button', { name: 'Submit' }).click();

		await expect.element(emptyError).toBeVisible();

		await expect.poll(() => removedRow.isConnected).toBe(false);
		await screen.getByRole('button', { name: 'Submit' }).click();

		await expect.element(emptyError).toBeVisible();
		// An empty list fails validation, so a retained row would instead reach onSubmit
		expect(onSubmit).not.toHaveBeenCalled();
	});

	test('Preserves edits made on a surviving row while the predecessor (at same index) exits', async () => {
		MotionGlobalConfig.skipAnimations = false;

		const onSubmit = vi.fn();
		const screen = await render(<TestForm onSubmit={onSubmit} />);
		const removedRow = screen.getByRole('listitem', { name: 'Item 1' }).element();

		// Delete predecessor (first row)
		await screen.getByRole('button', { name: 'Actions' }).first().click();
		await screen.getByRole('menuitem', { name: 'Delete' }).click();

		// Edit surviving row during exit transition
		const survivingDescription = screen.getByRole('textbox', { name: 'Description' }).last();
		await survivingDescription.fill('Updated surviving item');

		// Scope to the newest menu: the deleted row menu may still be mid-transition
		await screen.getByRole('button', { name: 'Actions' }).last().click();
		await screen.getByRole('menu').last().getByRole('menuitemcheckbox', { name: /GST/ }).click();
		await userEvent.keyboard('{Escape}');

		// Wait for predecessor to finish unmounting
		await expect.poll(() => removedRow.isConnected).toBe(false);

		// Verify submitted payload
		await screen.getByRole('button', { name: 'Submit' }).click();
		expect(onSubmit).toHaveBeenLastCalledWith(
			parser([{ ...itemB, label: 'Updated surviving item', taxes: new Set([vat.id, gst.id]) }]),
		);
	});
});

test.for([true, false])(
	'Respects default tax selection when tax registration is %s',
	async taxRegistration => {
		const onSubmit = vi.fn();
		const screen = await render(
			<TestForm onSubmit={onSubmit} items={[]} config={{ ...defaultConfig, taxRegistration }} />,
		);

		await screen.getByRole('button', { name: 'Add Item' }).click();
		await screen.getByRole('textbox', { name: 'Description' }).fill('Consulting');
		await screen.getByRole('textbox', { name: 'Quantity' }).fill('1');
		await screen.getByRole('textbox', { name: 'Each' }).fill('100');
		await screen.getByRole('button', { name: 'Submit' }).click();

		await expect
			.poll(() => onSubmit)
			.toHaveBeenCalledWith({
				items: [
					expect.objectContaining({ taxes: new Set(taxRegistration ? [gst.id, vat.id] : []) }),
				],
			});
	},
);

test('Duplicates a complete line item by value', async () => {
	const onSubmit = vi.fn();
	const screen = await render(<TestForm onSubmit={onSubmit} items={[itemA]} />);

	// Duplicate the first item
	await screen.getByRole('button', { name: 'Actions' }).click();
	await screen.getByRole('menuitem', { name: 'Duplicate' }).click();
	await expect.element(screen.getByRole('listitem').nth(1)).toBeVisible();
	// The closing menu stays mounted through its CSS exit transition
	await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();

	// Disable taxes on the duplicated item, to ensure that set reference is not shared
	await screen.getByRole('button', { name: 'Actions' }).last().click();
	await screen.getByRole('menuitemcheckbox', { name: /GST/ }).click();
	await userEvent.keyboard('{Escape}');

	await screen.getByRole('button', { name: 'Submit' }).click();

	expect(onSubmit).toHaveBeenCalledWith(parser([itemA, { ...itemA, taxes: new Set() }]));
});

test('Submits reordered items', async () => {
	const onSubmit = vi.fn();
	const screen = await render(<TestForm onSubmit={onSubmit} />);
	const firstHandle = screen.getByRole('button', { name: 'Reorder item' }).first();

	firstHandle.element().focus();
	await userEvent.keyboard('{Space}{ArrowDown}{Space}');
	await screen.getByRole('button', { name: 'Submit' }).click();

	expect(onSubmit).toHaveBeenCalledWith(parser([itemB, itemA]));
});

describe('Validation errors', () => {
	test('Renders an array-level error when no items have been added', async () => {
		const screen = await render(<TestForm items={[]} />);
		await screen.getByRole('button', { name: 'Submit' }).click();

		await expect
			.element(screen.getByRole('alert', { hasText: 'Invoice must contain items' }))
			.toBeVisible();
	});

	test('Renders empty field errors', async () => {
		const screen = await render(
			<TestForm
				items={[
					{
						label: '',
						note: '',
						quantity: '',
						unit: null,
						unitCost: '',
						taxes: new Set(),
					},
				]}
			/>,
		);

		await screen.getByRole('button', { name: 'Submit' }).click();

		await expect.element(screen.getByText('Please enter a description')).toBeVisible();
		await expect.element(screen.getByText('Enter quantity')).toBeVisible();
		await expect.element(screen.getByText('Enter cost')).toBeVisible();
	});

	test('Shows nested tax errors in the actions menu', async () => {
		// This should never happen, but we want to ensure an error is displayed correctly for ease of debug
		const screen = await render(
			<TestForm items={[invoiceItemBuilder({ taxes: new Set(['invalid-tax']) })]} />,
		);

		await screen.getByRole('button', { name: 'Submit' }).click();
		await screen.getByRole('button', { name: 'Actions' }).click();

		await expect.element(screen.getByText('Invalid tax: check configuration')).toBeVisible();
	});
});
