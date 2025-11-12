'use client';

import { DotsThreeIcon } from '@phosphor-icons/react';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { statusEnum } from '@/db/schema';
import { updateInvoiceStatus, voidInvoice } from '@/lib/actions';
import type { fetchInvoices } from '@/lib/data';
import { useInvoices } from '@/lib/hooks';
import { cn, type ElementType } from '@/lib/utils';
import type { Enum } from '@/lib/utils/drizzle';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/ui/alert-dialog';
import { Button } from '@/ui/button';
import { DataTable } from '@/ui/data-table';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/ui/select';

type Invoice = ElementType<Awaited<ReturnType<typeof fetchInvoices>>>;

export const columns: ColumnDef<Invoice>[] = [
	{
		accessorKey: 'reference',
		header: 'Reference',
		cell: ({ row }) => (
			<div className='font-medium group-data-void/row:line-through'>
				{row.original.formatted.reference}
			</div>
		),
		size: 150,
	},
	{
		accessorKey: 'client.name',
		header: 'Name',
		minSize: 200,
		maxSize: 400,
		cell: ({ row }) => (
			<div className='truncate group-data-void/row:line-through'>{row.original.client.name}</div>
		),
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: function StatusSelect({ row }) {
			const status: Enum<typeof statusEnum> = row.getValue('status');
			const id = row.original.id;

			const { mutate } = useInvoices();

			return (
				<div>
					<Select
						value={status}
						onValueChange={(v: typeof status) => {
							mutate(
								async curr => {
									await updateInvoiceStatus(id, v).catch(err => {
										toast.error('Failed to update invoice status');
										throw err;
									});

									// Function does not return. On success, use optimistic data.
									return curr
										? curr.map(item => (item.id === id ? { ...item, status: v } : item))
										: [];
								},
								{
									optimisticData: curr =>
										curr ? curr.map(item => (item.id === id ? { ...item, status: v } : item)) : [],
								},
							);
						}}
					>
						<SelectTrigger
							size='sm'
							className={cn(
								'!px-2 h-auto gap-1 rounded-sm py-1',
								status === 'unpaid' &&
									'!border-red-6 focus-visible:!border-red-7 !ring-red-6/50 !bg-red-3 text-red-12',
								status === 'paid' &&
									'!border-blue-6 focus-visible:!border-blue-7 !ring-blue-6/50 !bg-blue-3 text-blue-12',
								status === 'refunded' &&
									'!border-orange-6 focus-visible:!border-orange-7 !ring-orange-6/50 !bg-orange-3 text-orange-12',
							)}
						>
							<SelectValue placeholder='Update status…' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='unpaid'>Unpaid</SelectItem>
							<SelectItem value='paid'>Paid</SelectItem>
							<SelectSeparator />
							<SelectItem value='refunded'>Refunded</SelectItem>
						</SelectContent>
					</Select>
				</div>
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
				<div className='text-right font-medium tabular-nums group-data-void/row:line-through'>
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
			const { mutate } = useInvoices();

			return (
				<AlertDialog>
					<div className='-mr-2 flex justify-end gap-1'>
						<Button size='sm' variant='ghost' asChild>
							<a href={`/dashboard/invoices/${invoice.id}`}>
								View<span>↗</span>
							</a>
						</Button>
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button variant='ghost' size='icon' className='size-8 p-0'>
									<span className='sr-only'>Open menu</span>
									<DotsThreeIcon className='size-4' />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent side='right' align='start'>
								<DropdownMenuLabel>Actions</DropdownMenuLabel>
								<DropdownMenuItem
									onClick={() => navigator.clipboard.writeText(invoice.formatted.reference)}
								>
									Copy reference
								</DropdownMenuItem>
								<DropdownMenuSeparator />

								<AlertDialogTrigger asChild>
									<DropdownMenuItem disabled={invoice.isVoid} variant='destructive'>
										Void invoice
									</DropdownMenuItem>
								</AlertDialogTrigger>
								<DropdownMenuItem variant='destructive' disabled>
									Delete invoice
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Are you sure?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. You will still be able to access the invoice, but it
								will be marked as void.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								variant='destructive'
								onClick={() => {
									mutate(
										async curr => {
											await voidInvoice(invoice.id).catch(err => {
												toast.error('Failed to void invoice');
												throw err;
											});

											// Function does not return. On success, use optimistic data.
											return curr
												? curr.map(item =>
														item.id === invoice.id ? { ...item, isVoid: true } : item,
													)
												: [];
										},
										{
											optimisticData: curr =>
												curr
													? curr.map(item =>
															item.id === invoice.id ? { ...item, isVoid: true } : item,
														)
													: [],
										},
									);
								}}
							>
								Mark as void
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			);
		},
		size: 150,
	},
];

export default function Table({ filter }: { filter?: string }) {
	const { data, isLoading, isError } = useInvoices();

	if (isError) throw new Error('Failed to fetch invoices');

	return isLoading ? (
		<DataTable columns={columns} data={[]} />
	) : (
		data && (
			<DataTable
				columns={columns}
				data={data}
				globalFilter={filter || undefined}
				getRowAttr={row => ({
					'data-void': row.isVoid || undefined,
					className: 'data-void:opacity-50 group/row',
				})}
			/>
		)
	);
}
