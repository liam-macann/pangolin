import {
	createTableHook,
	type PaginationState,
	type RowData,
	type SortingState,
	type TableState,
} from '@tanstack/react-table';

import { useControllableState } from '@/lib/hooks/state';

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

/** Controlled table state with complete pagination when supplied. */
type DataTableState = Partial<TableState<DataTableFeatures>>;

/** Initial table state (allowing partial pagination defaults) */
type DataTableInitialState = Omit<DataTableState, 'pagination'> & {
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
	| 'initialState'
	| 'key'
	| 'onGlobalFilterChange'
	| 'onPaginationChange'
	| 'onSortingChange'
	| 'state'
> & {
	state?: DataTableState;
	initialState?: DataTableInitialState;
	onGlobalFilterChange?: (value: string) => void;
	onSortingChange?: (sorting: SortingState) => void;
	onPaginationChange?: (pagination: PaginationState) => void;
};

export function useDataTable<TData extends RowData, TSelected = TableState<DataTableFeatures>>(
	{
		initialState = {},
		state: stateProp,
		onGlobalFilterChange,
		onSortingChange,
		onPaginationChange,
		...options
	}: DataTableOptions<TData>,
	selector?: (state: TableState<DataTableFeatures>) => TSelected,
): DataTable<TData, TSelected> {
	const [globalFilter, setGlobalFilter] = useControllableState({
		value: stateProp?.globalFilter,
		defaultValue: initialState.globalFilter ?? '',
		onChange: onGlobalFilterChange,
	});

	const [sorting, setSorting] = useControllableState({
		value: stateProp?.sorting,
		defaultValue: initialState.sorting ?? [],
		onChange: onSortingChange,
	});

	const [pagination, setPagination] = useControllableState({
		value: stateProp?.pagination,
		defaultValue: {
			// Pass `Infinity` as `pageSize` to place every row on a single page
			pageSize: initialState.pagination?.pageSize ?? 20,
			pageIndex: initialState.pagination?.pageIndex ?? 0,
		},
		onChange: onPaginationChange,
	});

	const table = useAppTable(
		{
			...options,
			onGlobalFilterChange: value => {
				table.setColumnFilters([]);
				table.resetPageIndex();
				setGlobalFilter(value);
			},

			onSortingChange: updater => {
				table.resetPageIndex();
				setSorting(updater);
			},

			onPaginationChange: setPagination,
			state: { ...stateProp, globalFilter, sorting, pagination },
			initialState: {
				...initialState,
				// Pagination is defined here so that resets revert to these values
				pagination: {
					pageIndex: initialState.pagination?.pageIndex ?? 0,
					pageSize: initialState.pagination?.pageSize ?? 20,
				},
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
