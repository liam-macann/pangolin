'use client';

import { DotsThreeIcon } from '@phosphor-icons/react';
import type { ColumnDef } from '@tanstack/react-table';
import type { JSX } from 'react';
import { toast } from 'sonner';
import type { Data as InvoiceData } from '@/api/invoices/route';
import { createDataTable } from '@/components/data-table';
import { ToggleHeader } from '@/components/data-table/column-header';
import type { statusEnum } from '@/db/schema';
import { updateInvoiceStatus, voidInvoice } from '@/lib/actions/invoice';
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

type Invoice = ElementType<InvoiceData>;

export const columns: ColumnDef<Invoice>[] = [
	{
		accessorKey: 'formatted.reference',
		// Numeric sorting faster than alphanumeric, and works across all numbering schemes
		sortingFn: (a, b) => {
			const iA = a.original.index;
			const iB = b.original.index;
			return iA > iB ? 1 : iA < iB ? -1 : 0;
		},
		sortDescFirst: true,
		header: ({ column }) => <ToggleHeader column={column} title='Reference' />,
		cell: ({ row }) => (
			<div className='font-medium'>
				<span className='sr-only'>{row.original.isVoid && 'Void, '}</span>
				{row.original.formatted.reference}
			</div>
		),
		size: 150,
	},
	{
		accessorFn: row => row.client.name,
		accessorKey: 'client.name',
		header: ({ column }) => <ToggleHeader column={column} title='Name' />,
		minSize: 200,
		maxSize: 400,
		cell: ({ row }) => <div className='truncate'>{row.original.client.name}</div>,
	},
	{
		accessorKey: 'status',
		header: ({ column }) => <ToggleHeader column={column} title='Status' />,
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
								'!px-2 h-auto gap-1 rounded-sm py-1 capitalize',
								status === 'unpaid' &&
									'!border-red-6 focus-visible:!border-red-7 !ring-red-6/50 !bg-red-3 dark:!bg-red-4 dark:!border-red-6 text-red-12',
								status === 'paid' &&
									'!border-blue-6 focus-visible:!border-blue-7 !ring-blue-6/50 !bg-blue-3 dark:!bg-blue-4 dark:!border-blue-6 text-blue-12',
								status === 'refunded' &&
									'!border-orange-6 focus-visible:!border-orange-7 !ring-orange-6/50 !bg-orange-3 dark:!bg-orange-4 dark:!border-orange-6 text-orange-12',
							)}
						>
							<SelectValue placeholder='Update status…'>{status}</SelectValue>
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
		size: 160,
	},
	{
		accessorKey: 'issuedAt',
		header: ({ column }) => <ToggleHeader column={column} title='Date' />,
		cell: ({ row }) => row.original.formatted.issuedAt,
		sortingFn: 'datetime',
		size: 150,
	},
	{
		accessorKey: 'formatted.grossTotal',
		header: ({ column }) => (
			<div className='text-right'>
				<ToggleHeader column={column} title='Amount' />
			</div>
		),
		cell: ({ row }) => {
			return (
				<div className='text-right font-medium tabular-nums decoration-2 group-data-void/row:line-through'>
					{row.original.formatted.grossTotal}
				</div>
			);
		},
		sortingFn: (a, b) => {
			const iA = a.original.grossTotal;
			const iB = b.original.grossTotal;
			return iA > iB ? 1 : iA < iB ? -1 : 0;
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
						<Button
							size='sm'
							variant='ghost'
							className='pointer-fine:opacity-0 transition-none group-hocus-within/row:opacity-100'
							asChild
						>
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
		size: 125,
	},
];

const DataTable = createDataTable(columns);

export default function Table({ header, initial }: { header?: JSX.Element; initial?: Invoice[] }) {
	const { data } = useInvoices(initial, { suspense: true });

	return (
		<DataTable.Root
			data={data.map(invoice => ({ ...invoice, grossTotal: Number(invoice.grossTotal) }))}
			enableSortingRemoval={false}
			initialState={{ sorting: [{ id: 'formatted_reference', desc: true }] }}
		>
			<div className='my-4 mb-6 flex items-center justify-between gap-3 md:mt-8'>
				{header}
				<DataTable.Search className='h-10 grow shadow-none' />
			</div>
			<DataTable.Content
				getRowAttr={row => ({
					'data-void': row.isVoid || undefined,
					style: row.isVoid
						? {
								background: `repeating-linear-gradient(
                              45deg,
                              transparent,
                              transparent 2px,
                              var(--color-gray-3) 2px,
                              var(--color-gray-3) 4px
                            )`,
							}
						: undefined,
					className: 'data-void:opacity-50 group/row',
				})}
			/>
			<div className='flex items-center justify-end gap-2 py-4'>
				<DataTable.PaginationControls />
			</div>
		</DataTable.Root>
	);
}
