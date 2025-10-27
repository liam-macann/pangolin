'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CaretUpDownIcon } from '@phosphor-icons/react/ssr';
import { createInsertSchema } from 'drizzle-zod';
import { useState } from 'react';
import {
	Controller,
	type FieldValues,
	type Path,
	type UseFormReturn,
	useForm,
} from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { type clients as clientsSchema, invoices as invoicesSchema } from '@/db/schema';
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
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
} from '@/ui/field';
import { Input } from '@/ui/input';
import { InvoiceItemsField, itemsArraySchema } from './invoiceItems';

const schema = createInsertSchema(invoicesSchema, {
	clientId: z.uuid({ error: 'Please select a client' }),
	title: z
		.string()
		.optional()
		.transform(v => v?.trim())
		.transform(v => (v === '' ? undefined : v)),
	description: z
		.string()
		.optional()
		.transform(v => v?.trim())
		.transform(v => (v === '' ? undefined : v)),
	issuedAt: z.date({ error: 'Please select an issue date' }),
	dueAt: z.date({ error: 'Please select a due date' }),
})
	.omit({ createdAt: true, status: true, userId: true, id: true })
	.extend({
		items: itemsArraySchema,
	});

export function CreateInvoiceDialog({
	children,
	clients,
	config,
}: {
	children: React.ReactNode;
	clients: (typeof clientsSchema.$inferSelect)[];
	config: Prettify<
		Pick<
			Awaited<ReturnType<typeof getUserConfig>>,
			'id' | 'currency' | 'locale' | 'timezone' | 'tax'
		>
	>;
}) {
	const [open, setOpen] = useState(false);

	const options = clients.map(client => ({
		value: client.id,
		label: client.name,
	}));

	const form = useForm<z.input<typeof schema>>({
		resolver: zodResolver(schema),
		defaultValues: {
			clientId: '',
			issuedAt: new Date(),
			dueAt: new Date(new Date().setDate(new Date().getDate() + 14)),
			config: config.id,
			items: [],
			title: '',
			description: '',
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
					<FieldGroup>
						<Controller
							name='clientId'
							control={form.control}
							render={({ field, fieldState }) => (
								<Field orientation='responsive'>
									<FieldLabel
										// htmlFor='clientId'
										className='@md/field-group:-translate-y-1/2 @md/field-group:mt-4.5 self-start'
									>
										Bill To
									</FieldLabel>
									<div className='flex flex-col gap-1'>
										<Combobox
											options={options}
											noun={{ singular: 'client', plural: 'clients' }}
											className='@md/field-group:min-w-80'
											{...field}
										/>
										{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
									</div>
								</Field>
							)}
						/>
						<Controller
							name='title'
							control={form.control}
							render={({ field, fieldState }) => (
								<Field orientation='responsive'>
									<FieldLabel>Title</FieldLabel>
									<div className='flex flex-col gap-1'>
										<Input {...field} className='@md/field-group:min-w-80' />
										{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
									</div>
								</Field>
							)}
						/>
						<Controller
							name='description'
							control={form.control}
							render={({ field, fieldState }) => (
								<Field orientation='responsive'>
									<FieldLabel>Description</FieldLabel>
									<div className='flex flex-col gap-1'>
										<Input {...field} className='@md/field-group:min-w-80' />
										{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
									</div>
								</Field>
							)}
						/>
					</FieldGroup>
					<details>
						<Button asChild size='sm' variant='ghost' className='!-ml-2.5 text-muted-foreground'>
							<summary>
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
					<FieldSeparator className='-mx-6 my-3'>Items</FieldSeparator>

					<InvoiceItemsField
						config={config}
						control={form.control}
						getValues={form.getValues}
						className='mb-6'
					/>
				</form>

				<DialogFooter>
					<Button variant='primary' onClick={form.handleSubmit(onSubmit)}>
						Submit
					</Button>
					<DialogClose
						className='order-first'
						onClick={() => setTimeout(() => form.reset(), 200)}
						asChild
					>
						<Button variant='secondary'>Cancel</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
