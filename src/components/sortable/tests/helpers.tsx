import { type ReactNode } from 'react';
import { vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { SortableItem } from '@/components/sortable/sortable-item';
import { SortableList } from '@/components/sortable/sortable-list';
import { Sortable } from '@/components/sortable/sortable-root';

export type Item = {
	id: string;
	label: string;
};

export const sample: Item[] = [
	{ id: 'first', label: 'First item' },
	{ id: 'second', label: 'Second item' },
	{ id: 'third', label: 'Third item' },
];

/** Renders items in a sortable list, with a label as their default content. */
export async function renderSortable({
	items = sample,
	disabled = false,
	disableItem = () => false,
	children = item => <span>{item.label}</span>,
}: {
	items?: Item[];
	/** Disables the whole sortable */
	disabled?: boolean;
	disableItem?: (item: Item) => boolean;
	children?: (item: Item) => ReactNode;
} = {}) {
	const onReorder = vi.fn();

	const screen = await render(
		<Sortable items={items} onReorder={onReorder} disabled={disabled}>
			<SortableList>
				{(item: Item, index) => (
					<SortableItem
						key={item.id}
						id={item.id}
						index={index}
						disabled={disableItem(item)}
						data-testid={`item-${item.id}`}
					>
						{children(item)}
					</SortableItem>
				)}
			</SortableList>
		</Sortable>,
	);

	return {
		screen,
		locators: {
			items: screen.getByTestId(/^item-/),
			handles: screen.getByRole('button', { name: 'Reorder item' }),
			actions: screen.getByRole('button', { name: 'Actions' }),
		},
		onReorder,
	};
}
