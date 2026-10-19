import {
	type Cell,
	type PaginationState,
	type ReactTable,
	type RowData,
	type TableState,
} from '@tanstack/react-table';
import {
	type ComponentProps,
	type DetailedHTMLProps,
	type HTMLAttributes,
	type ReactNode,
	useDeferredValue,
	useState,
} from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

import { useInternalTableContext } from './context';
import { type DataTableFeatures } from './features';

/** Props of the default table content, which a render prop replaces. */
export type DataTableBodyProps<TData extends RowData> = {
	/** Whether to render the loading state, and announce busy to screen-readers. */
	loading?: boolean;

	/** Set attributes according to row data
	 *
	 * @example
	 * ```ts
	 * getRowAttr={row => ({ 'data-void': row.voidedAt !== null })}
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
	 * getCellAttr={cell => ({ 'data-void': row.voidedAt !== null })}
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
} & Omit<ComponentProps<typeof Table>, 'children'>;

/** Rejects the DataTableBody props, which a render prop never receives. */
type WithoutBodyProps<TData extends RowData> = {
	[K in keyof DataTableBodyProps<TData>]?: never;
};

export type DataTableContentProps<TData extends RowData, TSelected = never> =
	| (DataTableBodyProps<TData> & {
			// Use the default Content component
			selector?: never;
			children?: never;
	  })
	| (WithoutBodyProps<TData> & {
			// Override with a render prop, subscribed to whole state
			selector?: never;
			children: (
				table: ReactTable<DataTableFeatures, TData>,
				state: TableState<DataTableFeatures>,
			) => ReactNode;
	  })
	| (WithoutBodyProps<TData> & {
			// Override with a render prop, scoped to state slice
			/** Select the table state that should trigger custom content rerenders. */
			selector: (state: TableState<DataTableFeatures>) => TSelected;
			children: (table: ReactTable<DataTableFeatures, TData>, state: TSelected) => ReactNode;
	  });

/** DataTableContent component specialized to row type of the owning table */
export type DataTableContentComponent<TData extends RowData> = {
	(props: DataTableContentProps<TData>): ReactNode;
	<TSelected>(
		props: WithoutBodyProps<TData> & {
			selector: (state: TableState<DataTableFeatures>) => TSelected;
			children: (table: ReactTable<DataTableFeatures, TData>, state: TSelected) => ReactNode;
		},
	): ReactNode;
};

export function DataTableContent<TData extends RowData = RowData, TSelected = never>({
	getRowAttr,
	getCellAttr,
	className,
	selector,
	children,
	loading,
	...props
}: DataTableContentProps<TData, TSelected>) {
	const table = useInternalTableContext<TData>();

	if (children) {
		return selector ? (
			<table.Subscribe selector={selector}>{state => children(table, state)}</table.Subscribe>
		) : (
			<table.Subscribe selector={state => state}>{state => children(table, state)}</table.Subscribe>
		);
	}

	return (
		<Table className={cn('overflow-hidden', className)} {...props}>
			<DataTableHeader<TData> />
			<DataTableBody getRowAttr={getRowAttr} getCellAttr={getCellAttr} loading={loading} />
		</Table>
	);
}

function DataTableHeader<TData extends RowData>() {
	const table = useInternalTableContext<TData>();

	return (
		<table.Subscribe
			selector={state => ({
				columnSizing: state.columnSizing,
				columnVisibility: state.columnVisibility,
				sorting: state.sorting,
			})}
		>
			{() => (
				<TableHeader>
					{table.getHeaderGroups().map(headerGroup => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map(header => (
								<TableHead
									scope='col'
									aria-sort={
										header.column.getCanSort()
											? header.column.getIsSorted() === 'asc'
												? 'ascending'
												: header.column.getIsSorted() === 'desc'
													? 'descending'
													: 'none'
											: undefined
									}
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
							))}
						</TableRow>
					))}
				</TableHeader>
			)}
		</table.Subscribe>
	);
}

function DataTableBody<TData extends RowData>({
	getRowAttr,
	getCellAttr,
	loading,
}: Pick<DataTableContentProps<TData>, 'getCellAttr' | 'getRowAttr' | 'loading'>) {
	const table = useInternalTableContext<TData>();

	return (
		<table.Subscribe
			selector={state => ({
				columnFilters: state.columnFilters,
				columnVisibility: state.columnVisibility,
				globalFilter: state.globalFilter,
				pagination: state.pagination,
				sorting: state.sorting,
			})}
		>
			{state => (
				<DataTableRows
					pagination={state.pagination}
					filtered={!!state.globalFilter || state.columnFilters.length > 0}
					getRowAttr={getRowAttr}
					getCellAttr={getCellAttr}
					loading={loading}
				/>
			)}
		</table.Subscribe>
	);
}

/** Rows of the current page, or of the most recently shown page while the current one loads.
 * @param internalPagination Pagination state of the table, as subscribed to by the caller.
 * @returns The rows to show, and whether they are waiting on more rows or a deferred render. */
export function useDeferredPage<TData extends RowData>(internalPagination: PaginationState) {
	const table = useInternalTableContext<TData>();
	const loadedRows = table.getPrePaginatedRowModel().rows;

	// Rapid page changes render only the latest page, rather than every page passed through
	const pagination = useDeferredValue(internalPagination);

	// A page count of `-1` means the total may be unknown (as in cursor pagination)
	const expectedRowCount = table.getPageCount() === -1 ? Infinity : table.getRowCount();

	/** Whether we are waiting on more rows. */
	const pending =
		loadedRows.length <
		Math.min((pagination.pageIndex + 1) * pagination.pageSize, expectedRowCount);

	/** The page most recently shown, which stays on screen while the requested page is pending. */
	const [settled, setSettled] = useState(pagination);
	if (!pending && settled !== pagination) setSettled(pagination);

	const { pageIndex, pageSize } = pending ? settled : pagination;
	const rows = loadedRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

	return {
		/** Sliced rows that should be rendered for this page. */
		rows,
		/** Either waiting on rows, or the deferred state hasn't caught up. */
		busy: pending || pagination !== internalPagination,
	};
}

function DataTableRows<TData extends RowData>({
	pagination: internalPagination,
	filtered,
	getRowAttr,
	getCellAttr,
	loading,
}: Pick<DataTableContentProps<TData>, 'getCellAttr' | 'getRowAttr' | 'loading'> & {
	pagination: PaginationState;
	filtered: boolean;
}) {
	const table = useInternalTableContext<TData>();
	const page = useDeferredPage<TData>(internalPagination);
	const { rows } = page;
	const busy = loading || page.busy;

	return (
		<TableBody
			aria-busy={busy}
			className={cn(
				'transition-opacity duration-200 ease-in-out-circ',
				busy && 'cursor-wait opacity-50 delay-150 duration-500',
			)}
		>
			{rows.length ? (
				rows.map((row, rowIndex) => (
					<TableRow
						key={row.id}
						// data-state={row.getIsSelected() && 'selected'}
						{...getRowAttr?.(row.original, rowIndex)}
					>
						{row.getVisibleCells().map((cell, cellIndex) => {
							const cellProps = getCellAttr?.(cell, cellIndex);

							return (
								<TableCell
									key={cell.id}
									{...cellProps}
									className={cn(cellProps?.className, cell.column.columnDef.meta?.className)}
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
						colSpan={table.getVisibleLeafColumns().length}
						className='py-12 text-center text-base text-muted-foreground'
					>
						<div className='flex flex-col items-center gap-3'>
							<span>No results</span>
							{filtered ? (
								<Button
									variant='secondary'
									onClick={() => {
										table.resetColumnFilters();
										table.setGlobalFilter('');
									}}
								>
									Clear filters
								</Button>
							) : null}
						</div>
					</TableCell>
				</TableRow>
			)}
		</TableBody>
	);
}
