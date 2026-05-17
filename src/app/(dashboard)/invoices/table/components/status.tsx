'use client';

import { type Row } from '@tanstack/react-table';
import { cva } from 'class-variance-authority';
import { type ComponentProps } from 'react';
import { toast } from 'sonner';

import { type Data as InvoiceData } from '@/api/invoices/route';
import { updateInvoiceStatus } from '@/lib/actions/invoice';
import { cn } from '@/lib/utils';

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/ui/select';

import { type Invoice, useMutateRow } from './../columns';

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

export function StatusSelect({
	row,
	className,
	...props
}: { row: Row<Invoice> } & ComponentProps<typeof SelectTrigger>) {
	const status = row.original.status.status;
	const id = row.original.id;

	const { mutate } = useMutateRow(row.original.clientData.clientId);

	return (
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
					className,
				)}
				{...props}
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
	);
}
