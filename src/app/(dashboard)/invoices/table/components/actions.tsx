'use client';

import { ChatTextIcon, DotsThreeIcon } from '@phosphor-icons/react';
import { type Row } from '@tanstack/react-table';
import { type ComponentProps, useId } from 'react';

import { setInvoiceNotes, voidInvoice } from '@/lib/actions/invoice';
import { useInvoiceMutation } from '@/lib/hooks';

import { type DataTableFeatures } from '@/components/data-table';
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
import { toast } from '@/ui/toast';

import { type Invoice } from './../columns';

export function OverflowMenu({ row }: { row: Row<DataTableFeatures, Invoice> }) {
	const invoice = row.original;

	const { mutateAsync } = useInvoiceMutation({
		mutationFn: ({ id }: { id: string }) => voidInvoice(id),
		onError: () => toast.error('Failed to mark invoice as void'),
	});

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
						onClick={() => void mutateAsync({ id: invoice.id })}
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
	defaultValue,
	...props
}: ComponentProps<typeof PopoverTrigger> & {
	invoiceId: string;
	defaultValue?: string;
}) {
	const { mutateAsync } = useInvoiceMutation({
		mutationFn: ({ id, notes }: { id: string; notes: string }) => setInvoiceNotes(id, notes),
		onError: () => toast.error('Failed to update invoice notes'),
	});

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
						void mutateAsync({ id: invoiceId, notes: value });
					}}
					defaultValue={defaultValue}
					placeholder='Your private notes'
					className='inset-shadow-xs rounded-sm border-border! shadow-none ring-0!'
				/>
			</PopoverContent>
		</Popover>
	);
}
