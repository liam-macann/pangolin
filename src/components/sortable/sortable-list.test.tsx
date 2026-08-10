import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { SortableItem } from './sortable-item';
import { SortableList } from './sortable-list';
import { Sortable } from './sortable-root';

type Item = {
	id: string;
	label: string;
};

describe('SortableList', () => {
	test('Render items in their supplied order', async () => {
		const items: Item[] = [
			{ id: 'first', label: 'First item' },
			{ id: 'second', label: 'Second item' },
			{ id: 'third', label: 'Third item' },
		];

		const screen = await render(
			<Sortable items={items} onReorder={() => {}}>
				<SortableList>
					{(item: Item, index) => (
						<SortableItem key={item.id} id={item.id} index={index}>
							<input defaultValue={item.label} />
						</SortableItem>
					)}
				</SortableList>
			</Sortable>,
		);

		const inputs = screen.getByRole('textbox');
		await Promise.all(
			items.map((item, index) => expect.element(inputs.nth(index)).toHaveValue(item.label)),
		);
	});
});
