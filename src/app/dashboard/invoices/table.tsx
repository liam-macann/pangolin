'use no memo';
'use client';

import { TZDate } from '@date-fns/tz';
import { DotsThreeIcon } from '@phosphor-icons/react';
import type { ColumnDef } from '@tanstack/react-table';
import { cva } from 'class-variance-authority';
import { type ComponentProps, createContext, useContext } from 'react';
import { toast } from 'sonner';
import type { Data as InvoiceData } from '@/api/invoices/route';
import { createDataTable } from '@/components/data-table';
import { ToggleHeader } from '@/components/data-table/column-header';
import type { statusEnum } from '@/db/schema';
import { updateInvoiceStatus, voidInvoice } from '@/lib/actions/invoice';
import { useInvoices } from '@/lib/hooks';
import { cn, type ElementType, formatCurrency, formatDateToLocal } from '@/lib/utils';
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

export const statusVariants = cva('!px-2 rounded-sm border py-1 capitalize', {
	variants: {
		variant: {
			unpaid:
				'!border-red-6 focus-visible:!border-red-7 dark:focus-visible:!border-red-7/70 !ring-red-6/50 !bg-red-3 dark:!bg-red-10/20 dark:!border-red-6/50 text-red-12',
			paid: '!border-blue-6 focus-visible:!border-blue-7 dark:focus-visible:!border-blue-7/70 !ring-blue-6/50 !bg-blue-3 dark:!bg-blue-10/20 dark:!border-blue-6/50 text-blue-12',
			refunded:
				'!border-orange-6 focus-visible:!border-orange-7 dark:focus-visible:!border-orange-7/70 !ring-orange-6/50 !bg-orange-3 dark:!bg-orange-10/20 dark:!border-orange-6/70 text-orange-12',
		},
	},
});

type Invoice = ElementType<InvoiceData>;

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
		header: ({ column }) => <ToggleHeader column={column} title='Reference' />,
		cell: ({ row }) => (
			<div className='font-medium tabular-nums'>
				<span className='sr-only'>{row.original.isVoid && 'Void, '}</span>
				{row.original.reference}
			</div>
		),
		size: 150,
	},
	{
		accessorFn: row => row.clientData.name,
		accessorKey: 'clientData.name',
		id: 'name',
		header: ({ column }) => <ToggleHeader column={column} title='Name' />,
		minSize: 200,
		maxSize: 400,
		cell: ({ row }) => <div className='truncate'>{row.original.clientData.name}</div>,
	},
	{
		accessorKey: 'status',
		id: 'status',
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
							className={cn('h-auto gap-1', statusVariants({ variant: status }))}
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
		cell: ({ row }) => {
			const locale = useContext(LocaleContext);
			return (
				<span className='text-muted-foreground'>
					{formatDateToLocal(
						new TZDate(row.original.issuedAt, row.original.config.timezone),
						false,
						locale,
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
		cell: ({ row }) => {
			const locale = useContext(LocaleContext);
			return (
				<div className='text-right font-medium tabular-nums decoration-2 group-data-void/row:line-through'>
					{formatCurrency(row.original.grossTotal, row.original.config.currency, locale)}
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
							className='pointer-fine:opacity-0 transition-none focus:opacity-100 group-hover/row:opacity-100 max-md:hidden'
							nativeButton={false}
							render={
								<a href={`/dashboard/invoices/${invoice.id}`}>
									View<span>↗</span>
								</a>
							}
						/>
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button variant='ghost' size='icon' className='size-8 p-0'>
									<span className='sr-only'>Open menu</span>
									<DotsThreeIcon className='size-4' />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent side='right' align='start'>
								<DropdownMenuLabel>Actions</DropdownMenuLabel>

								<DropdownMenuItem asChild>
									<a href={`/dashboard/invoices/${invoice.id}`}>Download</a>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => navigator.clipboard.writeText(invoice.reference)}>
									Copy reference
								</DropdownMenuItem>
								<DropdownMenuSeparator />

								<AlertDialogTrigger
									render={
										<DropdownMenuItem disabled={invoice.isVoid} variant='destructive'>
											Void invoice
										</DropdownMenuItem>
									}
								/>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Voiding an invoice is permanent</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. You will still be able to view the invoice, but it
								will be no longer be included in any reports or summaries.
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

const LocaleContext = createContext<string>('en-AU');

/** Component factory that returns preconfigured defaults for Invoice data. Useful if omitting columns from the exported definition. */
export function createInvoiceTable<TValue>(columns: ColumnDef<Invoice, TValue>[]) {
	const FactoryDataTable = createDataTable(columns);

	const Root = ({
		data,
		locale,
		...props
	}: ComponentProps<typeof FactoryDataTable.Root> & { locale: string }) => (
		<LocaleContext value={locale}>
			<FactoryDataTable.Root
				data={data.map(invoice => ({
					...invoice,
					...('grossTotal' in invoice ? { grossTotal: Number(invoice.grossTotal) } : {}),
				}))}
				enableSortingRemoval={false}
				initialState={{ sorting: [{ id: 'reference', desc: true }] }}
				{...props}
			/>
		</LocaleContext>
	);

	const Content = (props: ComponentProps<typeof FactoryDataTable.Content>) => (
		<FactoryDataTable.Content
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
							backgroundSize: 'calc(4px * sqrt(2))',
						}
					: undefined,
				className: 'data-void:opacity-50 group/row',
			})}
			{...props}
		/>
	);

	const Search = (props: ComponentProps<typeof FactoryDataTable.Search>) => (
		<FactoryDataTable.Search placeholder='Search invoices…' {...props} />
	);

	return { ...FactoryDataTable, Root, Content, Search };
}

export const DataTable = createInvoiceTable(columns);
export default DataTable;
