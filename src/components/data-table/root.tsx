import {
	type ColumnDef,
	type PaginationState,
	type RowData,
	type SortingState,
	type TableOptions,
	type TableState,
	useTable,
} from '@tanstack/react-table';
import { type ReactNode } from 'react';

import { useControllableState } from '@/lib/hooks/state';

import { type DataTableFeatures, features } from './features';
import { type DataTableContext } from './types';

/** State slices managed by DataTable.Root with dedicated change callbacks. */
type ManagedTableState = {
	globalFilter?: string;
	sorting?: SortingState;
	pagination?: PaginationState;
};

type UnmanagedTableState = Omit<Partial<TableState<DataTableFeatures>>, keyof ManagedTableState>;

/** Controlled table state with complete pagination when supplied. */
type DataTableState = UnmanagedTableState & ManagedTableState;

/** Initial table state (allowing partial pagination defaults) */
type DataTableInitialState = UnmanagedTableState &
	Omit<ManagedTableState, 'pagination'> & {
		pagination?: Partial<PaginationState>;
	};

type DataTableRootProps<TData extends RowData> = {
	data: TData[];
	children: ReactNode;
	state?: DataTableState;
	initialState?: DataTableInitialState;
	onGlobalFilterChange?: (value: string) => void;
	onSortingChange?: (sorting: SortingState) => void;
	onPaginationChange?: (pagination: PaginationState) => void;
} & Pick<TableOptions<DataTableFeatures, TData>, 'enableSortingRemoval' | 'onColumnFiltersChange'>;

export function createDataTableRoot<TData extends RowData>(
	columns: ColumnDef<DataTableFeatures, TData>[],
	TableContext: DataTableContext<TData>,
) {
	return function Root({
		data,
		initialState = {},
		children,
		state: stateProp,
		onGlobalFilterChange,
		onSortingChange,
		onPaginationChange,
		...options
	}: DataTableRootProps<TData>) {
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

		const table = useTable({
			features,
			data,
			columns,

			/** Prevent page reset on data revalidation */
			autoResetPageIndex: false,
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

			...options,
			state: { ...stateProp, globalFilter, sorting, pagination },
			initialState: {
				...initialState,
				pagination: {
					pageIndex: initialState.pagination?.pageIndex ?? 0,
					pageSize: initialState.pagination?.pageSize ?? 20,
				},
			},
		});

		return <TableContext value={table}>{children}</TableContext>;
	};
}
