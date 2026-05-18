'use no memo';
'use client';

import { TZDate } from '@date-fns/tz';
import { type ColumnDef, type Row } from '@tanstack/react-table';
import { type ComponentProps, useContext } from 'react';
import { useSWRConfig } from 'swr';

import { type Data as InvoiceData } from '@/api/invoices/route';
import { cn, type ElementType, formatCurrency, formatDateToLocal } from '@/lib/utils';

import { ToggleHeader } from '@/components/data-table/column-header';

import { LocaleContext } from '.';
import { NotesButton, OverflowMenu } from './components/actions';
import { StatusSelect } from './components/status';

export type Invoice = ElementType<InvoiceData>;

/** Mutate invoices and client invoices simultaneously */
export function useMutateRow(clientId: string) {
	const { mutate } = useSWRConfig();

	type Params = Parameters<typeof mutate<InvoiceData>>;

	const fn = (data?: Params[1], opts?: Params[2]) => {
		mutate<InvoiceData>('/api/invoices', data, opts);
		mutate<InvoiceData>(`/api/invoices?client=${clientId}`, data, opts);
	};

	return { mutate: fn };
}

/** Column definitions for invoices */
export const columns: ColumnDef<Invoice>[] = [
	{
		accessorKey: 'reference',
		// Numeric sorting faster than alphanumeric, and works across all numbering schemes
		sortingFn: (a, b) => {
			const iA = a.original.index;
			const iB = b.original.index;
			return iA > iB ? 1 : iA < iB ? -1 : 0;
		},
		sortDescFirst: true,
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
						clientId={row.original.clientData.clientId}
						defaultValue={row.original.status.notes}
					/>
				)}
			</div>
		),
		size: 150,
	},
	{
		accessorFn: row => row.clientData.name,
		accessorKey: 'clientData.name',
		id: 'name',
		header: ({ column }) => <ToggleHeader column={column} title='Name' />,
		minSize: 140,
		size: 200,
		maxSize: 400,
		cell: ({ row }) => {
			const locale = useContext(LocaleContext);
			return (
				<div className='grid gap-1 py-1'>
					<div className='truncate'>{row.original.clientData.name}</div>

					<span className='text-muted-foreground text-xs group-data-void/row:text-muted-foreground/50 md:hidden'>
						{formatDateToLocal(
							new TZDate(row.original.issuedAt, row.original.config.timezone),
							false,
							locale,
							{ printCurrentYear: false },
						)}
					</span>

					<div className='mt-2 sm:hidden'>
						<StatusSelect row={row} />
					</div>
				</div>
			);
		},
	},
	{
		accessorFn: row => row.status.status,
		accessorKey: 'status.status',
		id: 'status',
		header: ({ column }) => <ToggleHeader column={column} title='Status' />,
		meta: { className: 'max-sm:hidden' },
		cell: ({ row }) => <StatusSelect row={row} />,
		minSize: 100,
		size: 170,
		maxSize: 200,
	},
	{
		accessorKey: 'issuedAt',
		header: ({ column }) => <ToggleHeader column={column} title='Date' />,
		meta: { className: 'max-md:hidden' },
		cell: ({ row }) => {
			const locale = useContext(LocaleContext);
			return (
				<span className='text-muted-foreground group-data-void/row:text-muted-foreground/50'>
					{formatDateToLocal(
						new TZDate(row.original.issuedAt, row.original.config.timezone),
						false,
						locale,
						{ printCurrentYear: false },
					)}
				</span>
			);
		},
		sortingFn: 'datetime',
		size: 150,
	},
	{
		accessorKey: 'grossTotal',
		header: ({ column }) => (
			<div className='text-right'>
				<ToggleHeader column={column} title='Amount' />
			</div>
		),
		cell: ({ row }) => <FormatPrice className='text-right' row={row} />,
		sortingFn: (a, b) => {
			const iA = a.original.grossTotal;
			const iB = b.original.grossTotal;
			return iA > iB ? 1 : iA < iB ? -1 : 0;
		},
		size: 150,
	},
	{
		id: 'actions',
		cell: ({ row }) => (
			<div className='-m-2 ml-0 flex translate-y-0.5 justify-end'>
				<OverflowMenu row={row} />
			</div>
		),
		size: 64,
	},
];

function FormatPrice({ row, className, ...props }: { row: Row<Invoice> } & ComponentProps<'div'>) {
	const locale = useContext(LocaleContext);
	const scribbleSize = '6rem';

	return (
		<div className={cn('font-medium tabular-nums decoration-2', className)} {...props}>
			<span className='relative'>
				{formatCurrency(row.original.grossTotal, row.original.config.currency, locale)}
				<div
					aria-hidden='true'
					className={cn(
						'filter-pencil-solid pointer-events-none absolute -inset-1 left-1/2 -translate-x-1/2 scale-x-100 bg-repeat-x',
						'hidden group-data-void/row:block', // Conditionally show when void
						'group-even/row:rotate-180 group-nth-[3n]/row:scale-y-120', // Row-to-row variation
					)}
					style={{
						// Quantise width to frequency of scribble (each 1/7th increment is a clean point to cut)
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
