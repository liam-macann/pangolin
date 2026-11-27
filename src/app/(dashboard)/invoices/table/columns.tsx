'use client';

import { type Row } from '@tanstack/react-table';
import { type ComponentProps } from 'react';

import { Invoice } from '@/api/dto/invoice';
import { useConfig } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currencies';
import { formatDate } from '@/lib/utils/date';

import { FunnelSimpleIcon } from '@/icons';

import { createDataTableColumnHelper, type DataTableFeatures } from '@/components/data-table';
import { DropdownHeader, ToggleHeader } from '@/components/data-table/column-header';
import { DropdownMenuCheckboxItem } from '@/ui/dropdown-menu';

import { NotesButton, OverflowMenu } from './components/actions';
import { StatusSelect } from './components/status';

export type { Invoice };

const columnHelper = createDataTableColumnHelper<Invoice>();

/** Column definitions for invoices */
export const columns = columnHelper.columns([
	columnHelper.accessor('reference', {
		enableSorting: false,
		header: ({ column }) => (
			<ToggleHeader column={column}>
				<span className=''>Reference</span>
			</ToggleHeader>
		),
		meta: { className: 'relative' },
		cell: ({ row }) => (
			<div className='flex gap-2 gap-y-0 font-medium text-xs tabular-nums max-sm:flex-col max-sm:justify-between sm:items-center'>
				<span className='sr-only'>{row.original.voidedAt !== null && 'Void, '}</span>
				{row.original.reference}

				{row.original.notes && (
					<NotesButton
						className='-mx-1 sm:-translate-y-px'
						invoiceId={row.original.id}
						defaultValue={row.original.notes}
					/>
				)}
			</div>
		),
		minSize: 75,
		size: 110,
	}),
	columnHelper.accessor(row => row.client.name || row.client.organization, {
		id: 'name',
		header: ({ column }) => <ToggleHeader column={column} title='Name' />,
		minSize: 140,
		size: 200,
		maxSize: 400,
		cell: ({ row, getValue }) => {
			const { data: config } = useConfig();
			return (
				<div className='py-1 leading-tight'>
					<div className='truncate'>{getValue()}</div>

					<span className='text-muted-foreground text-xs group-data-void/row:text-muted-foreground/50 md:hidden'>
						{formatDate(row.original.issuedAt, {
							locale: config.locale,
							omitCurrentYearIn: config.timezone,
						})}
					</span>

					<div className='mt-2 xs:hidden'>
						<StatusSelect row={row} />
					</div>
				</div>
			);
		},
	}),
	columnHelper.accessor(row => row.status, {
		id: 'status',
		enableSorting: false,
		filterFn: 'arrHas',
		header: ({ column }) => {
			const filterValue = column.getFilterValue();
			const selected = Array.isArray(filterValue) ? filterValue : [];

			return (
				<DropdownHeader column={column} title='Status' icon={<FunnelSimpleIcon />}>
					{Invoice.shape.status.options.map(status => (
						<DropdownMenuCheckboxItem
							key={status}
							className='capitalize'
							checked={selected.includes(status)}
							onCheckedChange={checked =>
								// An emptied selection auto-removes the filter
								column.setFilterValue(
									checked ? [...selected, status] : selected.filter(value => value !== status),
								)
							}
						>
							{status}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownHeader>
			);
		},
		meta: { className: 'max-xs:hidden' },
		cell: ({ row }) => <StatusSelect row={row} />,
		minSize: 120,
		size: 170,
		maxSize: 200,
	}),
	columnHelper.accessor('issuedAt', {
		header: ({ column }) => <ToggleHeader column={column} title='Date' />,
		meta: { className: 'max-md:hidden' },
		cell: ({ row }) => {
			const { data: config } = useConfig();
			return (
				<span className='text-muted-foreground group-data-void/row:text-muted-foreground/50'>
					{formatDate(row.original.issuedAt, {
						locale: config.locale,
						omitCurrentYearIn: config.timezone,
					})}
				</span>
			);
		},
		size: 150,
	}),
	columnHelper.accessor('grossTotal', {
		id: 'amount',
		header: ({ column }) => <ToggleHeader column={column} title='Amount' align='end' />,
		meta: { className: 'text-right' },
		cell: ({ row }) => <FormatPrice row={row} />,
		size: 150,
	}),
	columnHelper.accessor(row => row.client.id, {
		id: 'clientId',
		filterFn: 'equals',
		enableSorting: false,
		header: () => null,
		cell: () => null,
	}),
	columnHelper.display({
		id: 'actions',
		meta: { className: '!p-0' },
		cell: ({ row }) => (
			<div className='mr-1 flex items-center justify-end'>
				{/* A zero-width space gives the cell a text baseline to join the row baseline */}
				<span aria-hidden='true'>&#8203;</span>
				<OverflowMenu row={row} />
			</div>
		),
		size: 32,
	}),
]);

function FormatPrice({
	row,
	className,
	...props
}: { row: Row<DataTableFeatures, Invoice> } & ComponentProps<'div'>) {
	const { data: config } = useConfig();
	const scribbleSize = '6.5rem';

	return (
		<div
			className={cn(
				'font-medium tabular-nums decoration-2 group-data-void/row:text-foreground/50 group-data-void/row:opacity-70',
				className,
			)}
			{...props}
		>
			<span className='relative'>
				{formatCurrency(row.original.grossTotal, row.original.currency, config.locale)}
				<div
					aria-hidden='true'
					className={cn(
						'pointer-events-none absolute -inset-1 -inset-x-2.5 left-1/2 -translate-x-1/2',
						'mask-repeat-x bg-red-12/70 dark:bg-gray-12/80',
						'hidden group-data-void/row:block', // Conditionally show when void
						'group-even/row:rotate-180 group-nth-[3n]/row:scale-y-120', // Row-to-row variation
					)}
					style={{
						// Quantize width to frequency of scribble (each 1/7th increment is a clean point to cut)
						width: `round(up, 100%, calc(${scribbleSize}/7))`,

						// Center the scribble, locking it to the same grid
						maskSize: `${scribbleSize} auto`,
						maskPosition: `round(down, 50%, calc(${scribbleSize}/7)) 50%`,
						maskImage: 'url(/scribble.png)',
					}}
				/>
			</span>
		</div>
	);
}
