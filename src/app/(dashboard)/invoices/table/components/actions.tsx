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
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubContentTextarea,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Textarea } from '@/ui/textarea';
import { toast } from '@/ui/toast';

import { type Invoice } from './../columns';

/** Mirrors the notes limit in `@/lib/validation/invoice` */
const NOTES_MAX_LENGTH = 1000;

const useNotesMutation = (invoiceId: string) =>
	useInvoiceMutation({
		targetId: invoiceId,
		scope: { id: 'notes' },
		mutationFn: ({ id, notes }: { id: string; notes: string }) => setInvoiceNotes(id, notes),
		onError: (_error, { notes }) =>
			toast.error({
				title: 'Failed to update invoice notes',
				// Allow rejected text to be recovered, as it has been rolled back
				actionProps: notes
					? { children: 'Copy unsaved', onClick: () => navigator.clipboard.writeText(notes) }
					: undefined,
			}),
		optimisticFn: (curr, { notes }) => ({ ...curr, notes }),
	});

const useVoidMutation = ({ id: invoiceId, reference }: Pick<Invoice, 'id' | 'reference'>) =>
	useInvoiceMutation({
		targetId: invoiceId,
		scope: { id: 'void' },
		mutationFn: ({ id }: { id: string }) => voidInvoice(id),
		onError: () => toast.error('Failed to mark invoice as void'),
		onSuccess: () => toast.success(`Voided invoice ${reference}`),
	});

export function OverflowMenu({ row }: { row: Row<DataTableFeatures, Invoice> }) {
	const invoice = row.original;
	const { mutate: setNotes } = useNotesMutation(invoice.id);
	const { mutate: setVoid } = useVoidMutation(invoice);

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

						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								{invoice.notes ? 'Edit notes' : 'Add notes'}
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuSubContentTextarea
									label='Your private notes'
									defaultValue={invoice.notes ?? ''}
									maxLength={NOTES_MAX_LENGTH}
									onBlur={e => {
										// Skip the write when closing the submenu without changes
										const input = e.target.value.trim();
										const prev = invoice.notes?.trim() ?? '';
										if (input !== prev) setNotes({ id: invoice.id, notes: input });
									}}
								/>
							</DropdownMenuSubContent>
						</DropdownMenuSub>

						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(invoice.reference)}>
							Copy reference
						</DropdownMenuItem>

						<DropdownMenuSeparator />

						<DropdownMenuItem
							disabled={invoice.isVoid}
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
					<AlertDialogAction variant='destructive' onClick={() => setVoid({ id: invoice.id })}>
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
	const { mutate: setNotes } = useNotesMutation(invoiceId);
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
						// Skip the write when closing the submenu without changes
						const input = e.target.value.trim();
						const prev = defaultValue ?? '';
						if (input !== prev) setNotes({ id: invoiceId, notes: input });
					}}
					defaultValue={defaultValue}
					maxLength={NOTES_MAX_LENGTH}
					placeholder='Your private notes'
					className='inset-shadow-xs rounded-sm border-border! shadow-none ring-0!'
				/>
			</PopoverContent>
		</Popover>
	);
}
