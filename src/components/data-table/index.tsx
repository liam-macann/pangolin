'use client';

import { CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import {
	type Cell,
	type ColumnDef,
	columnFilteringFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_equals,
	globalFilteringFeature,
	metaHelper,
	type PaginationState,
	type ReactTable,
	type RowData,
	rowPaginationFeature,
	rowSortingFeature,
	type SortingState,
	sortFn_datetime,
	sortFn_text,
	type TableOptions,
	type TableState,
	tableFeatures,
	useTable,
} from '@tanstack/react-table';
import {
	type ComponentProps,
	createContext,
	type DetailedHTMLProps,
	type HTMLAttributes,
	type KeyboardEvent,
	type ReactNode,
	useContext,
} from 'react';

import { useControllableState } from '@/lib/hooks/state';
import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';
import { ButtonGroup } from '@/ui/button-group';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/input-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

export const dataTableFeatures = tableFeatures({
	columnFilteringFeature,
	globalFilteringFeature,
	rowSortingFeature,
	rowPaginationFeature,
	columnVisibilityFeature,
	columnSizingFeature,

	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	paginatedRowModel: createPaginatedRowModel(),

	filterFns: { equals: filterFn_equals },
	sortFns: { datetime: sortFn_datetime, text: sortFn_text },

	columnMeta: metaHelper<{ className?: string }>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/** Component factory, to create a typed data table */
export function createDataTable<TData extends RowData>(
	columns: ColumnDef<DataTableFeatures, TData>[],
) {
	const TableContext = createContext<ReactTable<DataTableFeatures, TData> | null>(null);

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

	type DataTableRootProps = {
		data: TData[];
		children: React.ReactNode;
		state?: DataTableState;
		initialState?: DataTableInitialState;
		onGlobalFilterChange?: (value: string) => void;
		onSortingChange?: (sorting: SortingState) => void;
		onPaginationChange?: (pagination: PaginationState) => void;
	} & Pick<
		TableOptions<DataTableFeatures, TData>,
		'enableSortingRemoval' | 'onColumnFiltersChange'
	>;

	function Root({
		data,
		initialState = {},
		children,
		state: stateProp,
		onGlobalFilterChange,
		onSortingChange,
		onPaginationChange,
		...options
	}: DataTableRootProps) {
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
			features: dataTableFeatures,
			data,
			columns,

			/** Prevent page reset on data revalidation */
			autoResetPageIndex: false,
			onGlobalFilterChange: val => {
				table.setColumnFilters([]);
				table.resetPageIndex();
				setGlobalFilter(val);
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
	}

	interface DataTableProps {
		/** Set attributes according to row data
		 *
		 * @example
		 * ```ts
		 * getRowAttr={row => ({ 'data-void': row.isVoid })}
		 * ```
		 */
		getRowAttr?: (
			row: TData,
			i: number,
		) => Omit<
			DetailedHTMLProps<HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement> & {
				[key: `data-${string}`]: string | boolean | number | undefined;
			},
			'data-state' | 'key'
		>;

		/** Set attributes according to cell data
		 *
		 * @example
		 * ```ts
		 * getCellAttr={cell => ({ 'data-void': row.isVoid })}
		 * ```
		 */
		getCellAttr?: (
			cell: Cell<DataTableFeatures, TData, unknown>,
			i: number,
		) => Omit<
			DetailedHTMLProps<HTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement> & {
				[key: `data-${string}`]: string | boolean | number | undefined;
			},
			'key'
		>;
	}

	function Content({
		getRowAttr,
		getCellAttr,
		className,
		children,
		...props
	}: DataTableProps &
		Omit<ComponentProps<typeof Table>, 'children'> & {
			children?: (table: ReactTable<DataTableFeatures, TData>) => ReactNode;
		}) {
		const table = useContext(TableContext);
		if (table === null) throw new Error('Content must be used within a DataTable.Root');

		if (children) return children(table);

		return (
			<Table className={cn('overflow-hidden', className)} {...props}>
				<TableHeader>
					{table.getHeaderGroups().map(headerGroup => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map(header => {
								return (
									<TableHead
										style={{
											width: `${header.getSize()}px`,
											minWidth: `${header.column.columnDef.minSize}px`,
											maxWidth: `${header.column.columnDef.maxSize}px`,
										}}
										key={header.id}
										className={header.column.columnDef.meta?.className}
									>
										{header.isPlaceholder ? null : <table.FlexRender header={header} />}
									</TableHead>
								);
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows?.length ? (
						table.getRowModel().rows.map((row, i) => (
							<TableRow
								key={row.id}
								// data-state={row.getIsSelected() && 'selected'}
								{...getRowAttr?.(row.original, i)}
							>
								{row.getVisibleCells().map((cell, i) => {
									const props = getCellAttr?.(cell, i);

									return (
										<TableCell
											key={cell.id}
											{...props}
											className={cn(props?.className, cell.column.columnDef.meta?.className)}
										>
											<table.FlexRender cell={cell} />
										</TableCell>
									);
								})}
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className='py-12 text-center text-base text-muted-foreground'
							>
								<div className='flex flex-col items-center gap-3'>
									<span>No results</span>
									{(table.state.globalFilter || table.state.columnFilters.length > 0) && (
										<Button
											variant='secondary'
											onClick={() => {
												table.resetColumnFilters();
												table.setGlobalFilter('');
											}}
										>
											Clear filters
										</Button>
									)}
								</div>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		);
	}

	function PaginationControls({
		conditional = true,
	}: {
		/** Whether controls should be hidden when there is only one page */
		conditional?: boolean;
	}) {
		const table = useContext(TableContext);
		if (table === null) throw new Error('PaginationControls must be used within a DataTable.Root');

		return (
			(conditional ? table.getPageCount() > 1 : true) && (
				<ButtonGroup>
					<Button
						variant='secondary'
						size='icon-sm'
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<span className='sr-only'>Previous</span>
						<CaretLeftIcon />
					</Button>
					<Button
						variant='secondary'
						size='sm'
						className='bg-secondary px-2 font-medium text-muted-foreground text-sm tabular-nums'
						onClick={() => table.resetPageIndex(true)}
					>
						{table.state.pagination.pageIndex + 1}
					</Button>
					<Button
						variant='secondary'
						size='icon-sm'
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						<span className='sr-only'>Next</span>
						<CaretRightIcon />
					</Button>
				</ButtonGroup>
			)
		);
	}

	function Search({
		onChange,
		placeholder,
		children,
		value,
		onKeyDown,
		...props
	}: Omit<ComponentProps<typeof InputGroup>, 'onKeyDown'> & {
		onKeyDown?: (
			e: KeyboardEvent<HTMLInputElement>,
			table: ReactTable<DataTableFeatures, TData>,
		) => void;
	} & Pick<ComponentProps<typeof InputGroupInput>, 'placeholder' | 'value'>) {
		const table = useContext(TableContext);
		if (table === null) throw new Error('Search must be used within a DataTable.Root');

		return (
			<InputGroup {...props}>
				<InputGroupAddon>
					<MagnifyingGlassIcon />
				</InputGroupAddon>
				<InputGroupInput
					aria-label='Search'
					placeholder={placeholder ?? 'Search…'}
					value={value ?? table.state.globalFilter}
					onChange={e => {
						onChange?.(e);
						table.setGlobalFilter(e.target.value);
					}}
					onKeyDown={e => onKeyDown?.(e, table)}
				/>
				{children}
			</InputGroup>
		);
	}

	return {
		Root,
		Content,
		PaginationControls,
		Search,
		Context: TableContext,
	};
}
