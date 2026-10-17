import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { createDataTableColumnHelper, type DataTableOptions, useDataTable } from './hook';

const columnHelper = createDataTableColumnHelper<{ name: string }>();
const columns = columnHelper.columns([columnHelper.accessor('name', { header: 'Name' })]);
const rows = Array.from({ length: 41 }, (_, index) => ({ name: `Item ${index + 1}` }));

function Table({
	data = rows,
	pageCount,
	...opts
}: Partial<DataTableOptions<(typeof rows)[number]>>) {
	const table = useDataTable({ data, columns, pageCount, ...opts });

	return (
		<table.AppTable>
			<output>Page {table.state.pagination.pageIndex + 1}</output>
			<table.Content />
		</table.AppTable>
	);
}

describe('Clamp pagination to result range', () => {
	const initialState = { pagination: { pageIndex: 4, pageSize: 20 } };

	test('Snaps back to the last page when the final count becomes known', async () => {
		const event = vi.fn();
		const screen = await render(
			<Table initialState={initialState} pageCount={-1} onPaginationChange={event} />,
		);

		await expect.element(screen.getByRole('status')).toHaveTextContent('Page 5');
		expect(event).not.toHaveBeenCalled();

		// Page count is no longer `-1`
		await screen.rerender(<Table initialState={initialState} onPaginationChange={event} />);

		await expect.element(screen.getByRole('status')).toHaveTextContent('Page 3');
		await expect.element(screen.getByRole('cell', { name: 'Item 41', exact: true })).toBeVisible();
		expect(event).toHaveBeenCalledExactlyOnceWith({ pageIndex: 2, pageSize: 20 });
	});

	test('Clamps an empty final result to the first page', async () => {
		const screen = await render(<Table initialState={initialState} pageCount={-1} />);

		await expect.element(screen.getByRole('status')).toHaveTextContent('Page 5');
		await screen.rerender(<Table initialState={initialState} data={[]} />);

		await expect.element(screen.getByRole('status')).toHaveTextContent('Page 1');
		await expect.element(screen.getByText('No results')).toBeVisible();
	});

	test('Keeps the index while the page count is unknown or the current page is valid', async () => {
		const screen = await render(<Table initialState={initialState} pageCount={-1} />);

		await screen.rerender(
			<Table initialState={initialState} data={rows.slice(0, 10)} pageCount={-1} />,
		);
		await expect.element(screen.getByRole('status')).toHaveTextContent('Page 5');

		await screen.rerender(<Table initialState={initialState} pageCount={5} />);
		await expect.element(screen.getByRole('status')).toHaveTextContent('Page 5');
	});
});
