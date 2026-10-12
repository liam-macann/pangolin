import { describe, expect, test } from 'vitest';

import { SortableHandle } from './sortable-handle';
import { renderSortable, sample } from './tests/helpers';

describe('SortableHandle', () => {
	test('Disables reorder handles when the sortable is disabled', async () => {
		const { locators } = await renderSortable({
			disabled: true,
			children: () => <SortableHandle />,
		});

		await expect.element(locators.handles.nth(0)).toBeDisabled();
		await expect.element(locators.handles.nth(1)).toBeDisabled();
	});

	test('Indicates when an item cannot be reordered', async () => {
		const { locators } = await renderSortable({
			disableItem: () => true,
			children: () => <SortableHandle />,
		});

		await Promise.all(sample.map((_, i) => expect.element(locators.handles.nth(i)).toBeDisabled()));
	});
});
