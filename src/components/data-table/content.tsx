import { type Cell, type ColumnDef, type ReactTable, type RowData } from '@tanstack/react-table';
import {
	type ComponentProps,
	type DetailedHTMLProps,
	type HTMLAttributes,
	type ReactNode,
	useContext,
} from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

import { type DataTableFeatures } from './features';
import { type DataTableContext } from './types';

type DataTableContentProps<TData extends RowData> = {
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
} & Omit<ComponentProps<typeof Table>, 'children'> & {
		children?: (table: ReactTable<DataTableFeatures, TData>) => ReactNode;
	};

export function createDataTableContent<TData extends RowData>(
	columns: ColumnDef<DataTableFeatures, TData>[],
	TableContext: DataTableContext<TData>,
) {
	return function Content({
		getRowAttr,
		getCellAttr,
		className,
		children,
		...props
	}: DataTableContentProps<TData>) {
		const table = useContext(TableContext);
		if (table === null) throw new Error('Content must be used within a DataTable.Root');

		if (children) return children(table);

		return (
			<Table className={cn('overflow-hidden', className)} {...props}>
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
								colSpan={columns.length}
								className='py-12 text-center text-base text-muted-foreground'
							>
								<div className='flex flex-col items-center gap-3'>
									<span>No results</span>
									{table.state.globalFilter || table.state.columnFilters.length > 0 ? (
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
			</Table>
		);
	};
}
