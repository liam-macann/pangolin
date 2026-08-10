import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { SortableEmpty } from './sortable-empty';
import { SortableHandle } from './sortable-handle';
import { SortableItem } from './sortable-item';
import { SortableList } from './sortable-list';
import { Sortable } from './sortable-root';

type Item = {
	id: string;
	label: string;
};

const sample: Item[] = [
	{ id: 'first', label: 'First item' },
	{ id: 'second', label: 'Second item' },
];

describe('SortableEmpty', () => {
	test('Is hidden when items are present', async () => {
		const screen = await render(
			<Sortable items={sample} onReorder={() => {}}>
				<SortableEmpty data-testid='empty'>No items yet</SortableEmpty>
			</Sortable>,
		);

		await expect.element(screen.getByTestId('empty')).not.toBeVisible();
	});

	test('Is shown when there are no items', async () => {
		const screen = await render(
			<Sortable items={[]} onReorder={() => {}}>
				<SortableEmpty data-testid='empty'>No items yet</SortableEmpty>
			</Sortable>,
		);

		await expect.element(screen.getByTestId('empty')).toHaveTextContent('No items yet');
		await expect.element(screen.getByTestId('empty')).toBeVisible();
	});

	test('Item controls are not rendered when there are no items', async () => {
		const screen = await render(
			<Sortable items={[]} onReorder={() => {}}>
				<SortableList>
					{(item: Item, index) => (
						<SortableItem data-testid='item' key={item.id} id={item.id} index={index}>
							<SortableHandle />
						</SortableItem>
					)}
				</SortableList>
			</Sortable>,
		);

		await expect.element(screen.getByTestId('item')).not.toBeInTheDocument();

		await expect
			.element(screen.getByRole('button', { name: 'Reorder item' }))
			.not.toBeInTheDocument();
	});
});
