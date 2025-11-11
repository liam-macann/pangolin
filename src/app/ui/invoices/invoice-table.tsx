'use client';

import { DotsThreeIcon } from '@phosphor-icons/react';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { fetchInvoices } from '@/lib/data';
import { useInvoices } from '@/lib/hooks';
import { cn, type ElementType } from '@/lib/utils';
import { Button } from '@/ui/button';
import { DataTable } from '@/ui/data-table';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';

type Invoice = ElementType<Awaited<ReturnType<typeof fetchInvoices>>>;

export const columns: ColumnDef<Invoice>[] = [
	{
		accessorKey: 'reference',
		header: 'Reference',
		cell: ({ row }) => <div className='font-medium'>{row.original.formatted.reference}</div>,
		size: 150,
	},
	{
		accessorKey: 'client.name',
		header: 'Name',
		minSize: 200,
		maxSize: 400,
		cell: ({ row }) => <div className='truncate'>{row.original.client.name}</div>,
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) => {
			const status: string = row.getValue('status');
			return (
				<span
					className={cn(
						'rounded px-2 py-1',
						status === 'unpaid' && 'border border-red-6 bg-red-3 text-red-12',
						status === 'paid' && 'border border-blue-6 bg-blue-3 text-blue-12',
					)}
				>
					{status.replace(/^./, char => char.toUpperCase())}
				</span>
			);
		},
		size: 150,
	},
	{
		accessorKey: 'issuedAt',
		header: 'Date',
		cell: ({ row }) => row.original.formatted.issuedAt,
		size: 150,
	},
	{
		accessorKey: 'grossTotal',
		header: () => <div className='text-right'>Amount</div>,
		cell: ({ row }) => {
			return (
				<div className='text-right font-medium tabular-nums'>
					{row.original.formatted.grossTotal}
				</div>
			);
		},
		size: 150,
	},
	{
		id: 'actions',
		cell: function OverflowMenu({ row }) {
			const invoice = row.original;

			return (
				<div className='-mr-2 flex justify-end gap-1'>
					<Button size='sm' asChild>
						<a href={`/dashboard/invoices/${invoice.id}`}>
							View<span>↗</span>
						</a>
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant='ghost' size='icon' className='size-8 p-0'>
								<span className='sr-only'>Open menu</span>
								<DotsThreeIcon className='size-4' />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem onClick={() => navigator.clipboard.writeText(invoice.id)}>
								Copy payment ID
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem disabled asChild>
								<button type='submit'>Delete invoice</button>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			);
		},
		size: 150,
	},
];

export default function Table() {
	const searchParams = useSearchParams();

	const { data, isLoading, isError } = useInvoices();

	if (isError) throw new Error('Failed to fetch invoices');

	return isLoading ? (
		<DataTable columns={columns} data={[]} />
	) : (
		data && (
			<DataTable
				columns={columns}
				data={data}
				globalFilter={searchParams.get('query') || undefined}
			/>
		)
	);
}
