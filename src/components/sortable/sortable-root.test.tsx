import { describe, expect, test, vi } from 'vitest';
import { commands } from 'vitest/browser';
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
	test('Executes onReorder callback after a pointer drag', async () => {
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
		const target = screen.getByRole('button', { name: 'Reorder item' }).nth(1);
		await commands.dragWithAnimation(handle.selector, target.selector);

		await expect.poll(() => onReorder).toHaveBeenCalledTimes(1);
		expect(onReorder).toHaveBeenCalledWith(expect.objectContaining({ initialIndex: 0, index: 1 }));
	});
});
