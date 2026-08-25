import { describe, expect, test, vi } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { SortableHandle } from './sortable-handle';
import { SortableItem } from './sortable-item';
import { SortableList } from './sortable-list';
import { Sortable } from './sortable-root';

type Item = {
	id: string;
	label: string;
};

describe('Sortable', () => {
	test('Executes onReorder callback after a keyboard-driven drag', async () => {
		// Using pointer-based drag introduced too much flakiness in Firefox, due to timing issues with underlying library
		const sample: Item[] = [
			{ id: 'first', label: 'First item' },
			{ id: 'second', label: 'Second item' },
		];
		const onReorder = vi.fn();

		const screen = await render(
			<Sortable items={sample} onReorder={onReorder}>
				<SortableList>
					{(item: Item, index) => (
						<SortableItem key={item.id} id={item.id} index={index}>
							<SortableHandle />
							<span data-testid={`item-${item.id}`}>{item.label}</span>
						</SortableItem>
					)}
				</SortableList>
			</Sortable>,
		);

		const handle = screen.getByRole('button', { name: 'Reorder item' }).first();
		handle.element().focus();
		await userEvent.keyboard('{Space}');
		await userEvent.keyboard('{ArrowDown}');
		await userEvent.keyboard('{Space}');

		await expect.poll(() => onReorder).toHaveBeenCalledTimes(1);
		expect(onReorder).toHaveBeenCalledWith(expect.objectContaining({ initialIndex: 0, index: 1 }));
	});

	test('Does not call onReorder when dragging leaves the item unchanged', async () => {
		const sample: Item[] = [
			{ id: 'first', label: 'First item' },
			{ id: 'second', label: 'Second item' },
		];
		const onReorder = vi.fn();

		const screen = await render(
			<Sortable items={sample} onReorder={onReorder}>
				<SortableList>
					{(item: Item, index) => (
						<SortableItem key={item.id} id={item.id} index={index} disabled={index === 1}>
							<SortableHandle />
							<span>{item.label}</span>
						</SortableItem>
					)}
				</SortableList>
			</Sortable>,
		);

		const handles = screen.getByRole('button', { name: 'Reorder item' });
		await commands.dragWithAnimation(handles.first().selector, handles.nth(1).selector);

		expect(onReorder).not.toHaveBeenCalled();
	});
});
