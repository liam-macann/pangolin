import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { SortableEmpty } from './sortable-empty';
import { SortableHandle } from './sortable-handle';
import { Sortable } from './sortable-root';
import { renderSortable, sample } from './tests/helpers';

describe('SortableEmpty', () => {
	test('Is hidden when items are present', async () => {
		const screen = await render(
			<Sortable items={sample} onReorder={() => {}}>
				<SortableEmpty data-testid='empty'>No items yet</SortableEmpty>
			</Sortable>,
		);

		await expect.element(screen.getByTestId('empty')).not.toBeVisible();
	});

	test('Is shown when there are no items', async () => {
		const screen = await render(
			<Sortable items={[]} onReorder={() => {}}>
				<SortableEmpty data-testid='empty'>No items yet</SortableEmpty>
			</Sortable>,
		);

		await expect.element(screen.getByTestId('empty')).toHaveTextContent('No items yet');
		await expect.element(screen.getByTestId('empty')).toBeVisible();
	});

	test('Item controls are not rendered when there are no items', async () => {
		const { locators } = await renderSortable({ items: [], children: () => <SortableHandle /> });

		await expect.element(locators.items).not.toBeInTheDocument();
		await expect.element(locators.handles).not.toBeInTheDocument();
	});
});
