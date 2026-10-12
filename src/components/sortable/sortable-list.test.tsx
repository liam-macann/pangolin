import { describe, expect, test } from 'vitest';

import { type Item, renderSortable } from './tests/helpers';

describe('SortableList', () => {
	test('Render items in their supplied order', async () => {
		const items: Item[] = [
			{ id: 'first', label: 'First item' },
			{ id: 'second', label: 'Second item' },
			{ id: 'third', label: 'Third item' },
		];

		const { screen } = await renderSortable({
			items,
			children: item => <input defaultValue={item.label} />,
		});

		const inputs = screen.getByRole('textbox');
		await Promise.all(
			items.map((item, index) => expect.element(inputs.nth(index)).toHaveValue(item.label)),
		);
	});
});
