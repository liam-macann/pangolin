import { useForm } from 'react-hook-form';
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { type RenderResult, render } from 'vitest-browser-react';

import { Sortable, SortableList } from '@/components/sortable';

import { LineItemRow } from './item-row';
import { type LineItemsConfig, type LineItemsFormValues } from './types';

const gst = { id: crypto.randomUUID(), name: 'GST', rate: '0.1000' } as const;

const config: LineItemsConfig = {
	currency: 'AUD',
	locale: 'en-AU',
	taxRegistration: true,
	taxes: [gst],
};

function TestForm({ onSubmit }: { onSubmit?: (values: LineItemsFormValues) => void }) {
	const { control, handleSubmit } = useForm<LineItemsFormValues>({
		defaultValues: {
			items: [
				{
					label: 'Consulting',
					note: '',
					quantity: '1',
					unit: null,
					unitCost: '100',
					taxes: new Set([gst.id]),
				},
			],
		},
	});

	return (
		<form onSubmit={handleSubmit(values => onSubmit?.(values))}>
			<Sortable items={[{ id: 'item' }]} onReorder={() => {}}>
				<SortableList>
					{(item, index) => (
						<LineItemRow
							key={item.id}
							itemId={item.id}
							index={index}
							control={control}
							config={config}
							onDuplicate={() => {}}
							onDelete={() => {}}
						/>
					)}
				</SortableList>
			</Sortable>
			<button type='submit'>Submit</button>
		</form>
	);
}

const fieldLocators = (screen: RenderResult) => ({
	description: screen.getByRole('textbox', { name: 'Description' }),
	quantity: screen.getByRole('textbox', { name: 'Quantity' }),
	unit: screen.getByRole('combobox', { name: 'Unit' }),
	each: screen.getByRole('textbox', { name: 'Each' }),
});

test('Preserves selected tax state when the actions menu is toggled', async () => {
	const screen = await render(<TestForm />);
	const trigger = screen.getByRole('button', { name: 'Actions' });

	await userEvent.click(trigger);

	const gstCheckbox = screen.getByRole('menuitemcheckbox', { name: /GST/ });
	await expect.element(gstCheckbox).toBeChecked();
	await gstCheckbox.click();
	await expect.element(gstCheckbox).not.toBeChecked();

	await userEvent.keyboard('{Escape}');
	await expect.element(gstCheckbox).not.toBeInTheDocument();

	await userEvent.click(trigger);
	await expect.element(gstCheckbox).not.toBeChecked();
});

test('Associates every field with an accessible label', async () => {
	const screen = await render(<TestForm />);

	const fields = fieldLocators(screen);

	await expect.element(fields.description).toBeVisible();
	await expect.element(fields.quantity).toBeVisible();
	await expect.element(fields.unit).toBeVisible();
	await expect.element(fields.each).toBeVisible();
});

test('Respects the selected unit type', async () => {
	const onSubmit = vi.fn();
	const screen = await render(<TestForm onSubmit={onSubmit} />);
	const fields = fieldLocators(screen);

	await fields.unit.click();
	await screen.getByRole('option', { name: 'hours' }).click();
	await screen.getByRole('button', { name: 'Submit' }).click();
	expect(onSubmit).toHaveBeenLastCalledWith(
		expect.objectContaining({ items: [expect.objectContaining({ unit: 'hours' })] }),
	);

	await fields.unit.click();
	await screen.getByRole('option', { name: 'Clear selection' }).click();
	await screen.getByRole('button', { name: 'Submit' }).click();
	expect(onSubmit).toHaveBeenLastCalledWith(
		expect.objectContaining({ items: [expect.objectContaining({ unit: null })] }),
	);
});

test.for([
	['quantity', '12'],
	['each', '-12'],
] satisfies [keyof ReturnType<typeof fieldLocators>, string][])(
	'Input "%s" does not allow typing unsupported characters',
	async ([field, expectedValue]) => {
		const screen = await render(<TestForm />);
		const input = fieldLocators(screen)[field];

		await input.clear();
		await userEvent.type(input, '−abc-ABC1e+2no-🐙$');

		await expect.element(input).toHaveValue(expectedValue);
	},
);

describe.for<[keyof ReturnType<typeof fieldLocators>, keyof LineItemsFormValues['items'][number]]>([
	['quantity', 'quantity'],
	['each', 'unitCost'],
])('%s input', ([field, prop]) => {
	test.for(['12,34', '12.34', '12'])('Accepts value: %s', async value => {
		const onSubmit = vi.fn();
		const screen = await render(<TestForm onSubmit={onSubmit} />);

		const fields = fieldLocators(screen);
		const input = fields[field];

		await input.clear();
		await userEvent.type(input, value);

		await expect.element(input).toHaveValue(value);
		await expect.element(input).toBeValid();

		await screen.getByRole('button', { name: 'Submit' }).click();
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ items: [expect.objectContaining({ [prop]: value })] }),
		);
	});
});
