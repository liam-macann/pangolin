'use client';

import { ChatTextIcon, DotsThreeIcon } from '@phosphor-icons/react';
import { type Row } from '@tanstack/react-table';
import { type ComponentProps, useId } from 'react';
import { toast } from 'sonner';

import { setInvoiceNotes, voidInvoice } from '@/lib/actions/invoice';

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
import { Textarea } from '@/ui/textarea';

import { type Invoice, useMutateRow } from './../columns';

export function OverflowMenu({ row }: { row: Row<Invoice> }) {
	const invoice = row.original;

	const { mutate } = useMutateRow(row.original.clientData.clientId);

	return (
		<AlertDialog>
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

						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(invoice.reference)}>
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

			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Voiding an invoice is permanent</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. You will still be able to view the invoice, but it will be
						no longer be included in any reports or summaries.
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
										? curr.map(item => (item.id === invoice.id ? { ...item, isVoid: true } : item))
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
}

export function NotesButton({
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
			<PopoverTrigger
				render={
					<Button className='text-inherit!' variant='ghost' size='icon-xs'>
						<span className='sr-only'>Notes</span>
						<ChatTextIcon aria-hidden className='size-3.5' />
					</Button>
				}
				{...props}
			/>
			<PopoverContent className='w-48 p-1' side='right' align='start'>
				<label htmlFor={fieldId} className='sr-only'>
					Your private notes
				</label>
				<Textarea
					ref={el => el?.focus({ preventScroll: true })}
					id={fieldId}
					onBlur={e => {
						const value = e.target.value;

						const updatedInvoices = (curr: Invoice[] | undefined) =>
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
				/>
			</PopoverContent>
		</Popover>
	);
}
