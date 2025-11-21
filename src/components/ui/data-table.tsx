'use client';

import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { type DetailedHTMLProps, type HTMLAttributes, useState } from 'react';
import { Button } from '@/ui/button';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	globalFilter?: string;

	/** Set attributes according to row data
	 *
	 * @example
	 * ```ts
	 * getRowAttr={row => ({ 'data-void': row.isVoid })}
	 * ```
	 */
	getRowAttr?: (row: TData) => Omit<
		DetailedHTMLProps<HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement> & {
			[key: `data-${string}`]: string | boolean | number | undefined;
		},
		'data-state' | 'key'
	>;
}

export function DataTable<TData, TValue>({
	columns,
	data,
	globalFilter,
	getRowAttr: getRowDataAttr,
}: DataTableProps<TData, TValue>) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		/** Prevent page reset on data revalidation */
		autoResetPageIndex: false,
		state: { globalFilter },
		initialState: { pagination: { pageSize: 20 } },
	});

	const [prevFilter, setPrevFilter] = useState(globalFilter);
	if (prevFilter !== globalFilter) {
		setPrevFilter(globalFilter);
		table.resetPageIndex();
	}

	return (
		<div>
			<div className='overflow-hidden'>
				<Table>
					<TableHeader className='border-y-2'>
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
							table.getRowModel().rows.map(row => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && 'selected'}
									{...getRowDataAttr?.(row.original)}
								>
									{row.getVisibleCells().map(cell => (
										<TableCell key={cell.id}>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className='h-24 text-center'>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className='flex items-center justify-end gap-2 py-4'>
				{table.getPageCount() > 0 && (
					<span className='mx-2 font-medium text-muted-foreground text-sm'>
						{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
					</span>
				)}
				<Button
					variant='outline'
					size='sm'
					onClick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
				>
					<span className='sr-only'>Previous</span>
					<CaretLeftIcon />
				</Button>
				<Button
					variant='outline'
					size='sm'
					onClick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
				>
					<span className='sr-only'>Next</span>
					<CaretRightIcon />
				</Button>
			</div>
		</div>
	);
}
