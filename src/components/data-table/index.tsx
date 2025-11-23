'use client';

import { CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type TableOptions,
	type Table as TanstackTable,
	useReactTable,
} from '@tanstack/react-table';
import {
	type ComponentProps,
	createContext,
	type DetailedHTMLProps,
	type HTMLAttributes,
	useContext,
	useState,
} from 'react';
import { Button } from '@/ui/button';
import { ButtonGroup } from '@/ui/button-group';
import { Input } from '@/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

/** Component factory, to create a typed data table */
export function createDataTable<TData, TValue>(columns: ColumnDef<TData, TValue>[]) {
	const TableContext = createContext<TanstackTable<TData> | null>(null);

	type DataTableRootProps = {
		data: TData[];
		children: React.ReactNode;
		pagination?: number | false;
	} & Pick<TableOptions<TData>, 'initialState' | 'enableSortingRemoval'>;

	function Root({
		data,
		initialState = {},
		children,
		pagination = 20,
		...options
	}: DataTableRootProps) {
		const [globalFilter, setGlobalFilter] = useState<string>('');

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
				table.resetPageIndex();
				setGlobalFilter(val);
			},

			...options,
			state: { globalFilter },
			initialState: {
				pagination: { pageSize: pagination || 20 },
				...initialState,
			},
		});

		return <TableContext value={{ ...table }}>{children}</TableContext>;
	}

	interface DataTableProps {
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

	function Content({ getRowAttr }: DataTableProps) {
		const table = useContext(TableContext);
		if (table === null) throw new Error('Content must be used within a DataTable.Root');

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
										{...getRowAttr?.(row.original)}
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
									<TableCell
										colSpan={columns.length}
										className='py-12 text-center text-base text-muted-foreground'
									>
										<div className='flex flex-col items-center gap-3'>
											<span>No results</span>
											{(table.getState().globalFilter ||
												table.getState().columnFilters.length > 0) && (
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
				</div>
			</div>
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
						size='sm'
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
						onClick={() => table.resetPageIndex()}
					>
						{table.getState().pagination.pageIndex + 1}
					</Button>
					<Button
						variant='secondary'
						size='sm'
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

	function Search({ onChange, ...props }: ComponentProps<typeof Input>) {
		const table = useContext(TableContext);
		if (table === null) throw new Error('Search must be used within a DataTable.Root');

		return (
			<Input
				aria-label='Search'
				placeholder='Search invoices…'
				value={table.getState().globalFilter}
				onChange={e => {
					onChange?.(e);
					table.setGlobalFilter(e.target.value);
				}}
				prefix={<MagnifyingGlassIcon />}
				{...props}
			/>
		);
	}

	return {
		Root,
		Content,
		PaginationControls,
		Search,
	};
}
