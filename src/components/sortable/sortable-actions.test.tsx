import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { SortableActions } from './sortable-actions';
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

describe('SortableActions', () => {
	test('Shows actions belonging to the selected item', async () => {
		const screen = await render(
			<Sortable items={sample} onReorder={() => {}}>
				<SortableList>
					{(item: Item, index) => (
						<SortableItem key={item.id} id={item.id} index={index}>
							<SortableActions>
								<button type='button'>Delete "{item.label}"</button>
							</SortableActions>
						</SortableItem>
					)}
				</SortableList>
			</Sortable>,
		);

		const trigger = screen.getByRole('button', { name: 'Actions' }).first();

		await expect
			.poll(async () => {
				await userEvent.click(trigger);
				return trigger.element().getAttribute('aria-expanded');
			})
			.toBe('true');

		await expect
			.element(screen.getByRole('button', { name: 'Delete "First item"' }))
			.toBeInTheDocument();

		await expect
			.element(screen.getByRole('button', { name: 'Delete "Second item"' }))
			.not.toBeInTheDocument();
	});

	test('Cannot be dragged', async () => {
		// The entire SortableItem becomes a drag surface when there is not SortableHandle.
		// SortableActions is a menu, and has distinct drag semantics (ie. releasing pointer over menu item)

		let flag = false;

		const screen = await render(
			<Sortable items={sample} onReorder={() => (flag = true)}>
				<SortableList>
					{(item: Item, index) => (
						<SortableItem key={item.id} id={item.id} index={index}>
							<SortableActions>
								<button type='button'>Delete "{item.label}"</button>
							</SortableActions>
							<span data-testid={`item-${item.id}`}>{item.label}</span>
						</SortableItem>
					)}
				</SortableList>
			</Sortable>,
		);

		const source = screen.getByRole('button', { name: 'Actions' }).first();
		const target = screen.getByTestId('item-second');
		await userEvent.dragAndDrop(source, target);

		expect(flag, 'Expected a drag started on the actions trigger not to reorder').toBe(false);
	});
});
