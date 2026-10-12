import { describe, expect, test } from 'vitest';
import { type Locator, userEvent } from 'vitest/browser';

import { SortableActions } from './sortable-actions';
import { renderSortable, sample } from './tests/helpers';

describe('SortableItem', () => {
	test('Item exposes an accessible name distinct from nested controls', async () => {
		const { screen } = await renderSortable({
			children: item => (
				<SortableActions>
					<button type='button'>Delete "{item.label}"</button>
				</SortableActions>
			),
		});

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

	describe('Reordering', () => {
		const moveDown = async (item: Locator) => {
			// The item only becomes focusable once registered as a drag source
			await expect.element(item).toHaveAttribute('tabindex', '0');
			item.element().focus();
			await expect.element(item).toHaveFocus();

			await userEvent.keyboard('{Space}');
			await userEvent.keyboard('{ArrowDown}');
			await userEvent.keyboard('{Space}');
		};

		test('Reorders an enabled item', async () => {
			const { locators, onReorder } = await renderSortable();

			await moveDown(locators.items.first());

			await expect
				.poll(() => onReorder)
				.toHaveBeenCalledExactlyOnceWith({ initialIndex: 0, index: 1 });
		});

		test('Does not reorder a disabled item', async () => {
			const { locators, onReorder } = await renderSortable({ disableItem: () => true });

			await moveDown(locators.items.first());

			expect(onReorder).not.toHaveBeenCalled();
		});
	});
});
