import { useCreateAtom } from '@tanstack/react-store';
import {
	createTableHook,
	type PaginationState,
	type RowData,
	type SortingState,
	type TableState,
} from '@tanstack/react-table';

import { DataTableContent, type DataTableContentComponent } from './internal/content';
import { cellContext, headerContext, tableContext } from './internal/context';
import { type DataTableFeatures, features } from './internal/features';
import { DataTablePaginationControls } from './internal/pagination-controls';
import { DataTableSearch } from './internal/search';

// Custom table hook with pre-bound components for composition
const { createAppColumnHelper, useAppTable, useTableContext } = createTableHook({
	features,
	tableContext,
	cellContext,
	headerContext,
	tableComponents: {
		Content: DataTableContent,
		PaginationControls: DataTablePaginationControls,
		Search: DataTableSearch,
	},

	/** Prevent page reset on data revalidation */
	autoResetPageIndex: false,
});

/** Initial table state (allowing partial pagination defaults) */
type DataTableInitialState = Omit<Partial<TableState<DataTableFeatures>>, 'pagination'> & {
	pagination?: Partial<PaginationState>;
};

type AppTableOptions<TData extends RowData> = Parameters<typeof useAppTable<TData>>[0];

type DataTable<TData extends RowData, TSelected> = Omit<
	ReturnType<typeof useAppTable<TData, TSelected>>,
	'Content'
> & {
	Content: DataTableContentComponent<TData>;
};

export type DataTableOptions<TData extends RowData> = Omit<
	AppTableOptions<TData>,
	'initialState' | 'key' | 'onGlobalFilterChange' | 'onPaginationChange' | 'onSortingChange'
> & {
	initialState?: DataTableInitialState;
	/** Called with the resolved global filter, after column filters are cleared and the table resets to page one. */
	onGlobalFilterChange?: (value: string) => void;
	/** Called with the resolved sort, after the table resets to page one. */
	onSortingChange?: (sorting: SortingState) => void;
	/** Called with the resolved pagination state. */
	onPaginationChange?: (pagination: PaginationState) => void;
};

export function useDataTable<TData extends RowData, TSelected = TableState<DataTableFeatures>>(
	{
		initialState = {},
		onGlobalFilterChange,
		onSortingChange,
		onPaginationChange,
		...options
	}: DataTableOptions<TData>,
	selector?: (state: TableState<DataTableFeatures>) => TSelected,
): DataTable<TData, TSelected> {
	// Own these slices via atoms rather than React state:
	// writing to an atom only re-renders subscribers
	const globalFilterAtom = useCreateAtom(initialState.globalFilter ?? '');
	const sortingAtom = useCreateAtom<SortingState>(initialState.sorting ?? []);
	const paginationAtom = useCreateAtom<PaginationState>({
		pageIndex: initialState.pagination?.pageIndex ?? 0,
		pageSize: initialState.pagination?.pageSize ?? 20,
	});

	const table = useAppTable(
		{
			...options,
			atoms: {
				...options.atoms,
				globalFilter: globalFilterAtom,
				sorting: sortingAtom,
				pagination: paginationAtom,
			},
			initialState: {
				...initialState,
				// Pagination is defined here so that resets revert to these values
				pagination: {
					pageIndex: initialState.pagination?.pageIndex ?? 0,
					pageSize: initialState.pagination?.pageSize ?? 20,
				},
			},

			onGlobalFilterChange: updater => {
				const next = typeof updater === 'function' ? updater(globalFilterAtom.get()) : updater;

				table.setColumnFilters([]);
				paginationAtom.set(previous => ({ ...previous, pageIndex: 0 }));
				globalFilterAtom.set(next);
				onGlobalFilterChange?.(next);
			},

			onSortingChange: updater => {
				const next = typeof updater === 'function' ? updater(sortingAtom.get()) : updater;

				paginationAtom.set(previous => ({ ...previous, pageIndex: 0 }));
				sortingAtom.set(next);
				onSortingChange?.(next);
			},

			onPaginationChange: updater => {
				const next = typeof updater === 'function' ? updater(paginationAtom.get()) : updater;

				paginationAtom.set(next);
				onPaginationChange?.(next);
			},
		},
		selector,
	);

	return table as DataTable<TData, TSelected>;
}

export type { DataTableFeatures } from './internal/features';
export {
	createAppColumnHelper as createDataTableColumnHelper,
	useTableContext as useDataTableContext,
};
