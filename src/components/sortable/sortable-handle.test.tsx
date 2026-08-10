import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

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

describe('SortableHandle', () => {
	test('Disables reorder handles when the sortable is disabled', async () => {
		const screen = await render(
			<Sortable items={sample} onReorder={() => {}} disabled>
				<SortableList>
					{(item: Item, index) => (
						<SortableItem key={item.id} id={item.id} index={index}>
							<SortableHandle />
						</SortableItem>
					)}
				</SortableList>
			</Sortable>,
		);

		const handles = screen.getByRole('button', { name: 'Reorder item' });

		await expect.element(handles.nth(0)).toBeDisabled();
		await expect.element(handles.nth(1)).toBeDisabled();
	});

	test('Indicates when an item cannot be reordered', async () => {
		const screen = await render(
			<Sortable items={sample} onReorder={() => {}}>
				<SortableList>
					{(item: Item, index) => (
						<SortableItem key={item.id} id={item.id} index={index} disabled>
							<SortableHandle />
						</SortableItem>
					)}
				</SortableList>
			</Sortable>,
		);

		const handles = screen.getByRole('button', { name: 'Reorder item' });
		await Promise.all(sample.map((_, index) => expect.element(handles.nth(index)).toBeDisabled()));
	});
});
