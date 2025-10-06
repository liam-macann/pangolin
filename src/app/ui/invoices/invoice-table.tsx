'use client';

import { DotsThreeIcon } from '@phosphor-icons/react';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import type { InvoiceWithClient } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { DataTable } from '@/ui/data-table';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { UpdateInvoiceDialog } from './create-form';

export const columns: ColumnDef<Omit<InvoiceWithClient, 'clientEmail'>>[] = [
	{
		accessorKey: 'yearIndex',
		header: 'Reference',
		cell: ({ row }) => {
			const issueYear: number = row.original.issueYear;
			const index: number = row.getValue('yearIndex');
			return (
				<div className='font-medium'>
					{issueYear.toString()}-{index.toString().padStart(3, '0')}
				</div>
			);
		},
	},
	{
		accessorKey: 'clientName',
		header: 'Name',
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
	},
	{
		accessorKey: 'issuedAt',
		header: 'Date',
		cell: ({ row }) => row.original.formatted.issuedAt,
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
	},
	{
		id: 'actions',
		cell: function OverflowMenu({ row }) {
			const invoice = row.original;
			const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

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
							<DropdownMenuItem onClick={() => setIsUpdateDialogOpen(true)}>
								Update invoice
							</DropdownMenuItem>
							<DropdownMenuItem disabled asChild>
								<button type='submit'>Delete invoice</button>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<UpdateInvoiceDialog
						invoice={invoice}
						open={isUpdateDialogOpen}
						onOpenChange={setIsUpdateDialogOpen}
						// biome-ignore lint/correctness/noChildrenProp: Null trigger required to place dialog outside of mounted menu
						// biome-ignore lint/complexity/noUselessFragments: Null trigger required to place dialog outside of mounted menu
						children={<></>}
					/>
				</div>
			);
		},
	},
];

export default function Table({ invoices }: { invoices: InvoiceWithClient[] }) {
	return <DataTable columns={columns} data={invoices} />;
}
