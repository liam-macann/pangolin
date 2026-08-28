'use client';

import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react';
import { type Row } from '@tanstack/react-table';
import { cva } from 'class-variance-authority';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { type ComponentProps } from 'react';

import { updateInvoiceStatus } from '@/lib/actions/invoice';
import { useAsyncStatus, useInvoiceMutation } from '@/lib/hooks';
import { cn } from '@/lib/utils';

import { type DataTableFeatures } from '@/components/data-table';
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
import { toast } from '@/ui/toast';

import { type Invoice } from './../columns';

export const statusVariants = cva('capitalize', {
	variants: {
		variant: {
			unpaid:
				'border-red-6! bg-red-3! text-red-12 ring-red-6/50! focus-visible:border-red-7! dark:border-red-6/50! dark:bg-red-10/20! dark:focus-visible:border-red-7/70!',
			paid: 'border-blue-6! bg-blue-3! text-blue-12 ring-blue-6/50! focus-visible:border-blue-7! dark:border-blue-6/50! dark:bg-blue-10/20! dark:focus-visible:border-blue-7/70!',
			refunded:
				'border-orange-6! bg-orange-3! text-orange-12 ring-orange-6/50! focus-visible:border-orange-7! dark:border-orange-6/70! dark:bg-orange-10/20! dark:focus-visible:border-orange-7/70!',
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
}: { row: Row<DataTableFeatures, Invoice> } & ComponentProps<typeof SelectTrigger>) {
	const invoice = row.original;
	const status = invoice.status.status;

	const { mutateAsync } = useInvoiceMutation({
		targetId: invoice.id,
		mutationFn: (status: Parameters<typeof updateInvoiceStatus>[1]) =>
			updateInvoiceStatus(invoice.id, status),
		scope: { id: 'status' },
		optimisticFn: (curr, next) => ({ ...curr, status: { ...curr.status, status: next } }),
	});

	const [updateStatus, track] = useAsyncStatus({
		onRejected: () => toast.error(`Failed to update status of ${invoice.reference}`),
	});

	return (
		<Select
			value={status}
			onValueChange={v => {
				if (!v) return;
				track(mutateAsync(v));
			}}
		>
			<SelectTrigger
				size='sm'
				className={cn(
					'relative size-auto h-7 gap-1 rounded-sm px-2! group-data-void/row:opacity-50',
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
