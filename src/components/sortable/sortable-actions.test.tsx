import { describe, expect, test } from 'vitest';
import { commands, userEvent } from 'vitest/browser';

import { SortableActions } from './sortable-actions';
import { renderSortable } from './tests/helpers';

describe('SortableActions', () => {
	test('Shows actions belonging to the selected item', async () => {
		const { screen, locators } = await renderSortable({
			children: item => (
				<SortableActions>
					<button type='button'>Delete "{item.label}"</button>
				</SortableActions>
			),
		});

		const trigger = locators.actions.first();

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

	test('Cannot be dragged', { retry: 2 }, async () => {
		// The entire SortableItem becomes a drag surface when there is not SortableHandle.
		// SortableActions is a menu, and has distinct drag semantics (ie. releasing pointer over menu item)

		const renderList = () =>
			renderSortable({
				children: item => (
					<>
						<SortableActions>
							<button type='button'>Delete "{item.label}"</button>
						</SortableActions>
						<span data-testid={`label-${item.id}`}>{item.label}</span>
					</>
				),
			});

		const { screen, locators, onReorder } = await renderList();
		await commands.dragWithAnimation(
			locators.actions.first().selector,
			screen.getByTestId('label-second').selector,
		);

		expect(onReorder, 'Expected the actions trigger not to move').not.toHaveBeenCalled();

		// Positive control: the same drag reorders when started elsewhere on the item
		await screen.unmount();
		const control = await renderList();
		await commands.dragWithAnimation(
			control.screen.getByTestId('label-first').selector,
			control.screen.getByTestId('label-second').selector,
		);

		await expect.poll(() => control.onReorder).toHaveBeenCalledTimes(1);
	});
});
