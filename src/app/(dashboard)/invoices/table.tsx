'use no memo';
'use client';

import { TZDate } from '@date-fns/tz';
import { ChatTextIcon, DotsThreeIcon } from '@phosphor-icons/react';
import { type ColumnDef } from '@tanstack/react-table';
import { cva } from 'class-variance-authority';
import { type ComponentProps, createContext, useContext, useId } from 'react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';

import { type Data as InvoiceData } from '@/api/invoices/route';
import { setInvoiceNotes, updateInvoiceStatus, voidInvoice } from '@/lib/actions/invoice';
import { cn, type ElementType, formatCurrency, formatDateToLocal } from '@/lib/utils';

import { createDataTable } from '@/components/data-table';
import { ToggleHeader } from '@/components/data-table/column-header';
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
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/ui/select';
import { Textarea } from '@/ui/textarea';

export const statusVariants = cva('capitalize', {
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

/** Mutate invoices and client invoices simultaneously */
function useMutateRow(clientId: string) {
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
		header: ({ column }) => <ToggleHeader column={column} title='Reference' />,
		cell: ({ row }) => (
			<div className='font-medium tabular-nums'>
				<span className='sr-only'>{row.original.status.isVoid && 'Void, '}</span>
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
		accessorFn: row => row.status.status,
		accessorKey: 'status.status',
		id: 'status',
		header: ({ column }) => <ToggleHeader column={column} title='Status' />,
		cell: function StatusSelect({ row }) {
			const status = row.original.status.status;
			const id = row.original.id;

			const { mutate } = useMutateRow(row.original.clientData.clientId);

			return (
				<div>
					<Select
						value={status}
						onValueChange={v => {
							if (!v) return;

							const updatedInvoices = (curr: InvoiceData | undefined) =>
								curr
									? curr.map(item =>
											item.id === id ? { ...item, status: { ...item.status, status: v } } : item,
										)
									: [];

							mutate(
								async current => {
									await updateInvoiceStatus(id, v).catch(err => {
										toast.error('Failed to update invoice status');
										// Error must rethrow to revert data on failure
										throw err;
									});

									// Function does not return. On success, use optimistic data.
									return updatedInvoices(current);
								},
								{ optimisticData: updatedInvoices },
							);
						}}
					>
						<SelectTrigger
							size='sm'
							className={cn(
								'!px-2 size-auto h-7 gap-1 rounded-sm group-data-void/row:opacity-50 [&_svg]:-mr-px! [&_svg]:size-3!',
								statusVariants({ variant: status }),
							)}
						>
							<SelectValue placeholder='Update status…'>{status}</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value='unpaid'>Unpaid</SelectItem>
								<SelectItem value='paid'>Paid</SelectItem>
								<SelectSeparator />
								<SelectItem value='refunded'>Refunded</SelectItem>
							</SelectGroup>
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
				<span className='text-muted-foreground group-data-void/row:text-muted-foreground/50'>
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
			const scribbleSize = '8rem';

			return (
				<div className='text-right font-medium tabular-nums decoration-2'>
					<span className='relative'>
						{formatCurrency(row.original.grossTotal, row.original.config.currency, locale)}
						<div
							aria-hidden='true'
							className={cn(
								'filter-pencil-solid pointer-events-none absolute inset-0 left-1/2 -translate-x-1/2 scale-x-100 bg-repeat-x opacity-85',
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

			const { mutate } = useMutateRow(row.original.clientData.clientId);

			return (
				<AlertDialog>
					<div className='-mr-2 flex justify-end'>
						{invoice.status.notes && (
							<NotesButton
								invoiceId={invoice.id}
								clientId={row.original.clientData.clientId}
								defaultValue={invoice.status.notes}
								render={
									<Button variant='ghost' size='icon-sm'>
										<span className='sr-only'>Notes</span>
										<ChatTextIcon aria-hidden />
									</Button>
								}
							/>
						)}

						<DropdownMenu modal={false}>
							<DropdownMenuTrigger
								render={
									<Button variant='ghost' size='icon-sm'>
										<span className='sr-only'>Open menu</span>
										<DotsThreeIcon aria-hidden />
									</Button>
								}
							/>
							<DropdownMenuContent side='right' align='start'>
								<DropdownMenuGroup>
									<DropdownMenuLabel>Actions</DropdownMenuLabel>

									<DropdownMenuItem render={<a href={`/invoices/${invoice.id}`}>View invoice</a>} />

									<DropdownMenuItem disabled>Add notes</DropdownMenuItem>

									<DropdownMenuItem
										onClick={() => navigator.clipboard.writeText(invoice.reference)}
									>
										Copy reference
									</DropdownMenuItem>
									<DropdownMenuSeparator />

									<DropdownMenuItem
										disabled={invoice.status.isVoid}
										variant='destructive'
										nativeButton
										render={<AlertDialogTrigger />}
									>
										Void invoice
									</DropdownMenuItem>
								</DropdownMenuGroup>
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
		size: 64,
	},
];

function NotesButton({
	invoiceId,
	clientId,
	defaultValue,
	...props
}: ComponentProps<typeof PopoverTrigger> & {
	invoiceId: string;
	clientId: string;
	defaultValue?: string;
}) {
	const { mutate } = useMutateRow(clientId);

	const fieldId = useId();

	return (
		<Popover>
			<PopoverTrigger {...props} />
			<PopoverContent className='w-48 p-1' side='right' align='start'>
				<label htmlFor={fieldId} className='sr-only'>
					Your private notes
				</label>
				<Textarea
					id={fieldId}
					onBlur={e => {
						const value = e.target.value;

						const updatedInvoices = (curr: InvoiceData | undefined) =>
							curr
								? curr.map(item => (item.id === invoiceId ? { ...item, notes: value } : item))
								: [];

						mutate(
							async current => {
								await setInvoiceNotes(invoiceId, value).catch(err => {
									toast.error('Failed to update invoice notes');
									// Error must rethrow to revert data on failure
									throw err;
								});

								// Function does not return. On success, use optimistic data.
								return updatedInvoices(current);
							},
							{ optimisticData: updatedInvoices },
						);
					}}
					defaultValue={defaultValue}
					placeholder='Your private notes'
					className='!ring-0 !border-border inset-shadow-xs rounded-sm shadow-none'
					autoFocus
				/>
			</PopoverContent>
		</Popover>
	);
}

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
				'data-void': row.status.isVoid || undefined,
				style: row.status.isVoid
					? {
							background: `repeating-linear-gradient(
                               45deg,
                               transparent,
                               transparent 2px,
                               color-mix(var(--color-gray-3) 50%, transparent) 2px,
                               color-mix(var(--color-gray-3) 50%, transparent) 4px
                          )`,
							backgroundSize: 'calc(4px * sqrt(2))',
						}
					: undefined,
				className: 'data-void:text-foreground/50 group/row',
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
