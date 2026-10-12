import { describe, expect, test } from 'vitest';
import { commands, userEvent } from 'vitest/browser';

import { SortableHandle } from './sortable-handle';
import { type Item, renderSortable } from './tests/helpers';

describe('Sortable', () => {
	const withHandle = (item: Item) => (
		<>
			<SortableHandle />
			<span>{item.label}</span>
		</>
	);

	test('Executes onReorder callback after a keyboard-driven drag', async () => {
		// Using pointer-based drag introduced too much flakiness in Firefox, due to timing issues with underlying library
		const { locators, onReorder } = await renderSortable({ children: withHandle });

		locators.handles.first().element().focus();
		await userEvent.keyboard('{Space}');
		await userEvent.keyboard('{ArrowDown}');
		await userEvent.keyboard('{Space}');

		await expect.poll(() => onReorder).toHaveBeenCalledTimes(1);
		expect(onReorder).toHaveBeenCalledWith(expect.objectContaining({ initialIndex: 0, index: 1 }));
	});

	test('Does not call onReorder when dragging leaves the item unchanged', async () => {
		const { locators, onReorder } = await renderSortable({
			disableItem: item => item.id !== 'first',
			children: withHandle,
		});

		await commands.dragWithAnimation(
			locators.handles.first().selector,
			locators.handles.nth(1).selector,
		);

		expect(onReorder).not.toHaveBeenCalled();
	});
});
