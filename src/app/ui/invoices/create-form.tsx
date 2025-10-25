'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createUpdateSchema } from 'drizzle-zod';
import { useEffect, useState } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { type clients as clientssSchema, invoices as invoicesSchema } from '@/db/schema';
import { createInvoice, updateInvoice } from '@/lib/actions';
import type { InvoiceWithClient } from '@/lib/data';
import type { Prettify } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Combobox } from '@/ui/combobox';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/ui/dialog';
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/ui/form';
import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';

export function applyZodErrors<T extends FieldValues>(
	form: UseFormReturn<T>,
	errors: Record<string, string[] | undefined>,
) {
	Object.entries(errors).forEach(([key, messages]) => {
		const message = messages?.[0];
		if (message) form.setError(key as Path<T>, { message });
	});
}

export function CreateInvoiceDialog({
	children,
	clients,
}: {
	children: React.ReactNode;
	clients: (typeof clientssSchema.$inferSelect)[];
}) {
	const [open, setOpen] = useState(false);

	const options = clients.map(client => ({
		value: client.id,
		label: client.name,
	}));

	const schema = z.object({
		clientId: z.uuid({ error: 'Please select a client' }),
		amount: z.coerce
			.number({ error: 'Please enter an amount' })
			.gt(0, { message: 'Please enter an amount greater than $0' }),
	});

	const form = useForm<z.input<typeof schema>>({
		resolver: zodResolver(schema),
		defaultValues: {
			clientId: '',
			amount: '0',
		},
	});
	async function onSubmit(values: z.input<typeof schema>) {
		const result = await createInvoice({
			...values,
			amount: Number(values.amount),
		});

		if (result.success) {
			toast.success(result.message);
			setOpen(false);
			form.reset();
		} else {
			// Handle server-side errors
			if (result.errors) applyZodErrors(form, result.errors.fieldErrors);
			toast.error(result.message || 'Something went wrong');
		}
	}
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<span>{children}</span>
			</DialogTrigger>

			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create invoice</DialogTitle>
					<DialogDescription>Create a new invoice for an existing client.</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
						<FormField
							control={form.control}
							name='clientId'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Client</FormLabel>
									<FormControl>
										<Combobox
											options={options}
											noun={{ singular: 'client', plural: 'clients' }}
											{...field}
										/>
									</FormControl>
									<FormDescription>Select an existing client to bill.</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name='amount'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Amount</FormLabel>
									<div className='relative flex items-center'>
										<FormControl>
											<Input
												type='number'
												step={0.01}
												min={0}
												{...field}
												value={String(field.value)}
												prefix='$'
											/>
										</FormControl>
									</div>
									<FormDescription>The invoice total sum.</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>
				</Form>

				<DialogFooter>
					<Button onClick={form.handleSubmit(onSubmit)}>Submit</Button>
					<DialogClose className='order-first' asChild>
						<Button variant='secondary'>Cancel</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function UpdateInvoiceDialog({
	children,
	invoice,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
}: {
	children: React.ReactNode;
	invoice: Prettify<
		Pick<InvoiceWithClient, 'id' | 'amount' | 'status' | 'clientId' | 'clientName'>
	>;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const [internalOpen, setInternalOpen] = useState(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = controlledOnOpenChange ?? setInternalOpen;

	const schema = createUpdateSchema(invoicesSchema, {
		amount: () =>
			z.coerce
				.number({ error: 'Please enter an amount' })
				.gt(0, { message: 'Please enter an amount greater than $0' }),
	});

	const form = useForm<z.input<typeof schema>>({
		resolver: zodResolver(schema),
		defaultValues: {
			amount: invoice.amount,
			status: invoice.status,
		},
	});

	// Reset form when dialog opens
	useEffect(() => {
		if (open)
			form.reset({
				amount: invoice.amount,
				status: invoice.status,
			});
	}, [open, invoice, form]);

	async function onSubmit(values: z.input<typeof schema>) {
		const result = await updateInvoice(invoice.id, {
			...values,
			amount: values.amount ? Number(values.amount) : undefined,
		});

		if (result.success) {
			toast.success(result.message);
			setOpen(false);
		} else {
			// Handle server-side errors
			if (result.errors) applyZodErrors(form, result.errors.fieldErrors);
			toast.error(result.message || 'Something went wrong');
		}
	}
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<span>{children}</span>
			</DialogTrigger>

			<DialogContent>
				<DialogHeader>
					<DialogTitle>Update invoice</DialogTitle>
					<DialogDescription>Amend an existing invoice.</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
						<FormItem>
							<FormLabel>Client</FormLabel>
							<FormControl>
								<Combobox
									disabled
									aria-readonly
									value={invoice.clientId}
									options={[{ value: invoice.clientId, label: invoice.clientName }]}
									noun={{ singular: 'client', plural: 'clients' }}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
						<FormField
							control={form.control}
							name='amount'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Amount</FormLabel>
									<FormDescription>The invoice total sum.</FormDescription>
									<div className='relative flex items-center'>
										<FormControl>
											<Input
												type='number'
												step={0.01}
												min={0}
												className='pl-6'
												{...field}
												value={String(field.value)}
											/>
										</FormControl>
										<span className='absolute ml-3 text-base md:text-sm'>$</span>
									</div>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name='status'
							render={({ field }) => (
								<FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
									<div className='space-y-0.5'>
										<FormLabel>Paid</FormLabel>
										<FormDescription>Whether payment has been received</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value === 'paid'}
											onCheckedChange={val => field.onChange(val ? 'paid' : 'unpaid')}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</form>
				</Form>

				<DialogFooter>
					<Button onClick={form.handleSubmit(onSubmit)}>Submit</Button>
					<DialogClose className='order-first' asChild>
						<Button variant='secondary'>Cancel</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
