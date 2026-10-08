import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from './command';

async function renderCommand() {
	// Enough rows to reach the list's maximum height and require scrolling.
	const labels = Array.from({ length: 24 }, (_, index) => `Item ${index + 1}`);
	const screen = await render(
		<Command>
			<CommandInput aria-label='Search' />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>
				<CommandGroup heading='Group A'>
					<CommandItem>Acme</CommandItem>
				</CommandGroup>
				<CommandGroup heading='Group B'>
					{labels.map(label => (
						<CommandItem key={label}>{label}</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</Command>,
	);
	const list = screen.getByRole('listbox');

	return {
		screen,
		locators: {
			search: screen.getByRole('combobox', { name: 'Search' }),
			empty: screen.getByText('No results found.'),
			list,
			group: (i: number) => list.getByRole('group').nth(i),
			item: (group: number = 1, item: number = 0) =>
				list.getByRole('group').nth(group).getByRole('option').nth(item),
		},
	};
}

describe('Command layout', () => {
	test('Group headings and surrounding spacing occupy one item row', async () => {
		// Keeping headings to a multiple of item height facilitates consistent scroll height

		const { locators } = await renderCommand();
		const lastItemInFirstGroup = locators.item(0, 0).element().getBoundingClientRect();
		const firstItemInNextGroup = locators.item(1, 0).element().getBoundingClientRect();

		// Measuring between item edges includes the heading and any group padding or margins.
		const headingSpace = firstItemInNextGroup.top - lastItemInFirstGroup.bottom;

		expect(lastItemInFirstGroup.height).toBeGreaterThan(0);
		expect(headingSpace).toBeCloseTo(lastItemInFirstGroup.height);
	});

	test('CommandEmpty height (with single-line text) is a multiple of item height', async () => {
		const { locators } = await renderCommand();
		// Measure an item before filtering removes it from the list.
		const itemHeight = locators.item().element().getBoundingClientRect().height;

		await locators.search.fill('No matching item');
		await expect.element(locators.empty).toBeVisible();

		const emptyRows = locators.empty.element().getBoundingClientRect().height / itemHeight;

		expect(itemHeight).toBeGreaterThan(0);
		expect(emptyRows).toBeGreaterThan(0);
		expect(emptyRows).toBeCloseTo(Math.round(emptyRows));
	});

	test('List height fits an integer of item rows', async () => {
		// When scrolling down the list with a keyboard, items should exactly fit into list region.
		// This prevents jitter when changing directions.

		const { locators } = await renderCommand();
		const list = locators.list.element();
		const style = getComputedStyle(list);

		const itemHeight = locators.item().element().getBoundingClientRect().height;
		const scrollPaddingY =
			Number.parseFloat(style.scrollPaddingTop) + Number.parseFloat(style.scrollPaddingBottom);

		// Keyboard scrolling reserves space at both edges
		const usableHeight = list.getBoundingClientRect().height - scrollPaddingY;
		const visibleRows = usableHeight / itemHeight; // This should be an integer

		expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
		expect(itemHeight).toBeGreaterThan(0);
		expect(visibleRows).toBeCloseTo(Math.round(visibleRows));
	});
});
