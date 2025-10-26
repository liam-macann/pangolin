'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CaretUpDownIcon } from '@phosphor-icons/react/ssr';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { useEffect, useState } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
	type clients as clientsSchema,
	invoiceItems as invoiceItemsSchema,
	invoices as invoicesSchema,
} from '@/db/schema';
import { createInvoice, updateInvoice } from '@/lib/actions';
import type { getUserConfig, InvoiceWithClient } from '@/lib/data';
import type { Prettify } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Combobox } from '@/ui/combobox';
import { DatePicker } from '@/ui/date-picker';
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
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
} from '@/ui/field';
import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';

const itemsSchema = createInsertSchema(invoiceItemsSchema);

const schema = createInsertSchema(invoicesSchema, {
	clientId: z.uuid({ error: 'Please select a client' }),
	issuedAt: z.date({ error: 'Please select an issue date' }),
	dueAt: z.date({ error: 'Please select a due date' }),
	// items: z.array(itemsSchema),
}).omit({ createdAt: true, status: true });

export function CreateInvoiceDialog({
	children,
	clients,
	config,
}: {
	children: React.ReactNode;
	clients: (typeof clientsSchema.$inferSelect)[];
	config: Prettify<
		Pick<Awaited<ReturnType<typeof getUserConfig>>, 'currency' | 'locale' | 'timezone'>
	>;
}) {
	const [open, setOpen] = useState(false);

	const options = clients.map(client => ({
		value: client.id,
		label: client.name,
	}));

	const form = useForm<z.infer<typeof schema>>({
		resolver: zodResolver(schema),
		defaultValues: {
			clientId: '',
			issuedAt: new Date(),
			dueAt: new Date(new Date().setDate(new Date().getDate() + 14)),
		},
	});
	async function onSubmit(values: z.input<typeof schema>) {
		const result = createInvoice({
			...values,
		}).then(() => {
			setOpen(false);
			form.reset();
		});

		toast.promise(result, {
			loading: 'Creating invoice…',
			success: 'Invoice created',
			error: 'Failed to create invoice',
		});
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
				<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
					<Controller
						name='clientId'
						control={form.control}
						render={({ field, fieldState }) => (
							<Field>
								<FieldLabel>Client</FieldLabel>
								<Combobox
									options={options}
									noun={{ singular: 'client', plural: 'clients' }}
									className='justify-self-start'
									{...field}
								/>
								<FieldDescription>Select an existing client to bill.</FieldDescription>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
					<Controller
						name='title'
						control={form.control}
						render={({ field, fieldState }) => (
							<Field>
								<FieldLabel>Title</FieldLabel>
								<Input {...field} />
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
					<details>
						<Button asChild size='sm' variant='ghost' className='!-ml-2.5 text-muted-foreground'>
							<summary className=''>
								Advanced <CaretUpDownIcon />
							</summary>
						</Button>
						<FieldGroup className='mt-4 flex flex-row gap-3'>
							<Controller
								name='issuedAt'
								control={form.control}
								disabled
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor='form-rhf-textarea-about'>Date of issue</FieldLabel>
										<DatePicker startMonth={new Date()} timeZone={config.timezone} {...field} />
										{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
									</Field>
								)}
							/>
							<Controller
								name='dueAt'
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor='form-rhf-textarea-about'>Due date</FieldLabel>
										<DatePicker
											disabledDays={[{ before: new Date() }, new Date()]}
											startMonth={new Date()}
											timeZone={config.timezone}
											{...field}
										/>
										{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
									</Field>
								)}
							/>
						</FieldGroup>
					</details>
				</form>

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
