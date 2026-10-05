'use client';

import { WarningIcon } from '@phosphor-icons/react';
import { type ComponentProps, type ReactElement, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { Alert, AlertTitle } from '@/ui/alert';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/ui/responsive-dialog';

import { CreateInvoiceForm, useCreateInvoiceForm } from './form';
import { type CreateInvoiceConfig } from './types';

export function CreateInvoiceDialog({
	children,
	config,
	...props
}: {
	children: ReactElement;
	config: CreateInvoiceConfig;
} & ComponentProps<typeof Dialog>) {
	const [open, setOpen] = useState(false);
	const form = useCreateInvoiceForm(config);

	return (
		<Dialog open={open} onOpenChange={setOpen} {...props}>
			<DialogTrigger render={children} />

			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create invoice</DialogTitle>
					<DialogDescription>Create a new invoice for an existing client.</DialogDescription>
				</DialogHeader>

				<ErrorBoundary
					fallback={
						<Alert variant='destructive' className='my-6'>
							<WarningIcon />
							<AlertTitle>Something went wrong! Please try again later.</AlertTitle>
						</Alert>
					}
				>
					<CreateInvoiceForm config={config} onSuccess={() => setOpen(false)} {...form} />
				</ErrorBoundary>
			</DialogContent>
		</Dialog>
	);
}
