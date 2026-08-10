import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { SortableActions } from './sortable-actions';
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

describe('SortableItem', () => {
	test('Item exposes an accessible name distinct from nested controls', async () => {
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

		// Without an accessible name, the item (role="button") derives name from content, colliding with
		// nested controls and making both indistinguishable to accessible-name-based queries.
		//
		// Only applies when there is no SortableHandle present.
		const items = screen.getByRole('button', { name: /^Item \d+$/ });
		expect(items).toHaveLength(sample.length);
		expect(items.elements().every(element => element.tagName === 'LI')).toBe(true);
		expect(new Set(items.elements().map(element => element.ariaLabel)).size).toBe(sample.length);

		const actions = screen.getByRole('button', { name: 'Actions' }).elements();
		expect(actions).toHaveLength(sample.length);
		expect(actions.every(element => element.tagName === 'BUTTON')).toBe(true);
	});

	test('Does not reorder a disabled item', async () => {
		const onReorder = vi.fn();

		const screen = await render(
			<Sortable items={sample} onReorder={onReorder}>
				<SortableList>
					{(item: Item, index) => (
						<SortableItem key={item.id} id={item.id} index={index} disabled>
							<SortableHandle data-testid={`handle-${item.id}`} />
						</SortableItem>
					)}
				</SortableList>
			</Sortable>,
		);

		const source = screen.getByTestId('handle-first');
		const target = screen.getByTestId('handle-second');
		await userEvent.dragAndDrop(source, target);

		expect(onReorder).not.toHaveBeenCalled();
	});
});
