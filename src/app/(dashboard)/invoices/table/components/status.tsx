'use client';

import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react';
import { type Row } from '@tanstack/react-table';
import { cva } from 'class-variance-authority';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { type ComponentProps } from 'react';
import { toast } from 'sonner';

import { type Data as InvoiceData } from '@/api/invoices/route';
import { updateInvoiceStatus } from '@/lib/actions/invoice';
import { useAsyncStatus } from '@/lib/hooks';
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
import { Spinner } from '@/ui/spinner';

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

const variants = {
	visible: { opacity: 1, scale: 1 },
	hidden: { opacity: 0, scale: 0.5 },
};

export function StatusSelect({
	row,
	className,
	...props
}: { row: Row<Invoice> } & ComponentProps<typeof SelectTrigger>) {
	const status = row.original.status.status;
	const id = row.original.id;

	const { mutate } = useMutateRow(row.original.clientData.clientId);

	const [updateStatus, track] = useAsyncStatus({
		onRejected: () => toast.error('Failed to update invoice status'),
	});

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
						await track(updateInvoiceStatus(id, v));

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
					'!px-2 relative size-auto h-7 gap-1 rounded-sm group-data-void/row:opacity-50',
					statusVariants({ variant: status }),
					className,
				)}
				{...props}
			>
				<div className='absolute top-1/2 -right-2 flex size-4 translate-x-full -translate-y-1/2 items-center justify-center p-0 text-muted-foreground *:fill-mode-forwards'>
					<MotionConfig transition={{ duration: 0.12 }}>
						<AnimatePresence initial={false} mode='wait'>
							{updateStatus === 'rejected' && (
								<motion.div
									animate='visible'
									exit='hidden'
									initial='hidden'
									key='check'
									variants={variants}
									// Safari has weird 'settling' issue when transform starts and finishes
									className='will-change-transform'
								>
									<XCircleIcon />
								</motion.div>
							)}
							{updateStatus === 'fulfilled' && (
								<motion.div
									animate='visible'
									exit='hidden'
									initial='hidden'
									key='fulfilled'
									variants={variants}
									className='will-change-transform'
								>
									<CheckCircleIcon />
								</motion.div>
							)}
							{updateStatus === 'pending' && (
								<motion.div
									animate='visible'
									exit='hidden'
									initial='hidden'
									key='loading'
									variants={variants}
									className='will-change-transform'
								>
									<Spinner className='size-full' />
								</motion.div>
							)}
						</AnimatePresence>
					</MotionConfig>
				</div>
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
