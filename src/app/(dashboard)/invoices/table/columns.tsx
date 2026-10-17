'use client';

import { type Row } from '@tanstack/react-table';
import { type ComponentProps } from 'react';

import { type Invoice } from '@/api/dto/invoice';
import { useConfig } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currencies';
import { formatDate } from '@/lib/utils/date';

import { createDataTableColumnHelper, type DataTableFeatures } from '@/components/data-table';
import { ToggleHeader } from '@/components/data-table/column-header';

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
				<span className='max-sm:hidden'>Reference</span>
				<span className='sm:hidden'>Ref.</span>
			</ToggleHeader>
		),
		meta: { className: 'relative' },
		cell: ({ row }) => (
			<div className='flex gap-2 gap-y-0 font-medium text-xs tabular-nums max-sm:flex-col max-sm:justify-between sm:items-center'>
				<span className='sr-only'>{row.original.status.isVoid && 'Void, '}</span>
				{row.original.reference}

				{row.original.status.notes && (
					<NotesButton
						className='-mx-1 sm:-translate-y-px'
						invoiceId={row.original.id}
						defaultValue={row.original.status.notes}
					/>
				)}
			</div>
		),
		size: 150,
	}),
	columnHelper.accessor(row => row.clientData.name || row.clientData.organization, {
		id: 'name',
		header: ({ column }) => <ToggleHeader column={column} title='Name' />,
		minSize: 140,
		size: 200,
		maxSize: 400,
		cell: ({ row, getValue }) => {
			const { data: config } = useConfig();
			return (
				<div className='grid gap-1 py-1'>
					<div className='truncate'>{getValue()}</div>

					<span className='text-muted-foreground text-xs group-data-void/row:text-muted-foreground/50 md:hidden'>
						{formatDate(row.original.issuedAt, {
							locale: config.locale,
							omitCurrentYearIn: config.timezone,
						})}
					</span>

					<div className='mt-2 sm:hidden'>
						<StatusSelect row={row} />
					</div>
				</div>
			);
		},
	}),
	columnHelper.accessor(row => row.status.status, {
		id: 'status',
		enableSorting: false,
		header: ({ column }) => <ToggleHeader column={column} title='Status' />,
		meta: { className: 'max-sm:hidden' },
		cell: ({ row }) => <StatusSelect row={row} />,
		minSize: 100,
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
		header: ({ column }) => (
			<div className='text-right'>
				<ToggleHeader column={column} title='Amount' />
			</div>
		),
		cell: ({ row }) => <FormatPrice className='text-right' row={row} />,
		size: 150,
	}),
	columnHelper.accessor(row => row.clientData.clientId, {
		id: 'clientId',
		filterFn: 'equals',
		enableSorting: false,
		header: () => null,
		cell: () => null,
	}),
	columnHelper.display({
		id: 'actions',
		cell: ({ row }) => (
			<div className='-m-2 ml-0 flex translate-y-0.5 justify-end'>
				<OverflowMenu row={row} />
			</div>
		),
		size: 64,
	}),
]);

function FormatPrice({
	row,
	className,
	...props
}: { row: Row<DataTableFeatures, Invoice> } & ComponentProps<'div'>) {
	const { data: config } = useConfig();
	const scribbleSize = '6rem';

	return (
		<div
			className={cn(
				'font-medium tabular-nums decoration-2 group-data-void/row:text-foreground/50 group-data-void/row:opacity-70',
				className,
			)}
			{...props}
		>
			<span className='relative'>
				{formatCurrency(row.original.grossTotal, row.original.config.currency, config.locale)}
				<div
					aria-hidden='true'
					className={cn(
						'filter-pencil-solid pointer-events-none absolute -inset-1 -inset-x-2.5 left-1/2 -translate-x-1/2 bg-repeat-x',
						'hidden opacity-80 group-data-void/row:block', // Conditionally show when void
						'group-even/row:rotate-180 group-nth-[3n]/row:scale-y-120', // Row-to-row variation
					)}
					style={{
						// Quantize width to frequency of scribble (each 1/7th increment is a clean point to cut)
						width: `round(up, 100%, calc(${scribbleSize}/7))`,

						// Center scribble pattern, locking to grid position
						// (left and right positioning would also work, but this ensures the first and last strokes vary)
						backgroundPosition: `round(down, 50%, calc(${scribbleSize}/7)) 50%`,
						backgroundSize: scribbleSize,
						backgroundImage: 'url("/scribble.svg")',
					}}
				/>
			</span>
		</div>
	);
}
