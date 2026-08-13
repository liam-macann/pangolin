import { type Cell, type ReactTable, type RowData, type TableState } from '@tanstack/react-table';
import {
	type ComponentProps,
	type DetailedHTMLProps,
	type HTMLAttributes,
	type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

import { useInternalTableContext } from '@/components/data-table/internal/context';
import { type DataTableFeatures } from '@/components/data-table/internal/features';
import { Button } from '@/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

export type DataTableContentProps<TData extends RowData, TSelected = never> = {
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
} & Omit<ComponentProps<typeof Table>, 'children'> &
	(
		| {
				// Use the default Content component
				selector?: never;
				children?: undefined;
		  }
		| {
				// Override with a render prop, subscribed to whole state
				selector?: never;
				children: (
					table: ReactTable<DataTableFeatures, TData>,
					state: TableState<DataTableFeatures>,
				) => ReactNode;
		  }
		| {
				// Override with a render prop, scoped to state slice
				/** Select the table state that should trigger custom content rerenders. */
				selector: (state: TableState<DataTableFeatures>) => TSelected;
				children: (table: ReactTable<DataTableFeatures, TData>, state: TSelected) => ReactNode;
		  }
	);

/** DataTableContent component specialized to row type of the owning table */
export type DataTableContentComponent<TData extends RowData> = {
	(props: DataTableContentProps<TData>): ReactNode;
	<TSelected>(
		props: Omit<DataTableContentProps<TData>, 'children' | 'selector'> & {
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
			<DataTableBody getRowAttr={getRowAttr} getCellAttr={getCellAttr} />
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
}: Pick<DataTableContentProps<TData>, 'getCellAttr' | 'getRowAttr'>) {
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
				<TableBody>
					{table.getRowModel().rows.length ? (
						table.getRowModel().rows.map((row, rowIndex) => (
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
									{state.globalFilter || state.columnFilters.length > 0 ? (
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
			)}
		</table.Subscribe>
	);
}
