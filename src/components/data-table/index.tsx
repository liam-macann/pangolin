'use no memo';
'use client';

import { CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import {
	type Cell,
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	type TableOptions,
	type TableState,
	type Table as TanstackTable,
	useReactTable,
} from '@tanstack/react-table';
import {
	type ComponentProps,
	createContext,
	type DetailedHTMLProps,
	type HTMLAttributes,
	type KeyboardEvent,
	type ReactNode,
	useContext,
	useState,
} from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';
import { ButtonGroup } from '@/ui/button-group';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/input-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

declare module '@tanstack/react-table' {
	interface ColumnMeta<TData, TValue> {
		className?: string;
	}
}

/** Component factory, to create a typed data table */
export function createDataTable<TData, TValue>(columns: ColumnDef<TData, TValue>[]) {
	const TableContext = createContext<TanstackTable<TData> | null>(null);

	type DataTableRootProps = {
		data: TData[];
		children: React.ReactNode;
		pagination?: number | false;
		state?: Partial<TableState>;
		onGlobalFilterChange?: (value: string) => void;
		onSortingChange?: (sorting: SortingState) => void;
		onPageIndexChange?: (pageIndex: number) => void;
	} & Pick<TableOptions<TData>, 'initialState' | 'enableSortingRemoval' | 'onColumnFiltersChange'>;

	function Root({
		data,
		initialState = {},
		children,
		pagination = 20,
		state: stateProp,
		onGlobalFilterChange,
		onSortingChange,
		onPageIndexChange,
		...options
	}: DataTableRootProps) {
		const [globalFilterState, setGlobalFilterState] = useState(initialState.globalFilter ?? '');
		const [sortingState, setSortingState] = useState<SortingState>(initialState.sorting ?? []);

		const pageSize = typeof pagination === 'number' ? pagination : 20;
		const [pageIndexState, setPageIndexState] = useState(initialState.pagination?.pageIndex ?? 0);

		const globalFilter =
			stateProp?.globalFilter !== undefined ? stateProp.globalFilter : globalFilterState;
		const sorting = stateProp?.sorting !== undefined ? stateProp.sorting : sortingState;
		const pageIndex =
			stateProp?.pagination?.pageIndex !== undefined
				? stateProp.pagination.pageIndex
				: pageIndexState;

		const table = useReactTable({
			data,
			columns,

			getCoreRowModel: getCoreRowModel(),
			getFilteredRowModel: getFilteredRowModel(),
			getSortedRowModel: getSortedRowModel(),
			...(pagination !== false && { getPaginationRowModel: getPaginationRowModel() }),

			/** Prevent page reset on data revalidation */
			autoResetPageIndex: false,
			onGlobalFilterChange: val => {
				table.setColumnFilters([]);
				table.resetPageIndex();
				if (stateProp?.globalFilter === undefined) setGlobalFilterState(val);
				onGlobalFilterChange?.(val);
			},

			onSortingChange: updater => {
				const next = typeof updater === 'function' ? updater(sorting) : updater;
				table.resetPageIndex();
				if (stateProp?.sorting === undefined) setSortingState(next);
				onSortingChange?.(next);
			},

			onPaginationChange: updater => {
				const next = typeof updater === 'function' ? updater({ pageSize, pageIndex }) : updater;
				if (stateProp?.pagination?.pageIndex === undefined) setPageIndexState(next.pageIndex);
				onPageIndexChange?.(next.pageIndex);
			},

			...options,
			state: { ...stateProp, globalFilter, sorting, pagination: { pageSize, pageIndex } },
			initialState: {
				...initialState,
				pagination: { ...initialState.pagination, pageSize },
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
			cell: Cell<TData, unknown>,
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
			children?: (table: TanstackTable<TData>) => ReactNode;
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
										{header.isPlaceholder
											? null
											: flexRender(header.column.columnDef.header, header.getContext())}
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
								data-state={row.getIsSelected() && 'selected'}
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
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
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
									{(table.getState().globalFilter || table.getState().columnFilters.length > 0) && (
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
						{table.getState().pagination.pageIndex + 1}
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
		onKeyDown: (e: KeyboardEvent<HTMLInputElement>, table: TanstackTable<TData>) => void;
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
					value={value ?? table.getState().globalFilter}
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
