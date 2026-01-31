'use client';

import { TZDate } from '@date-fns/tz';
import { zodResolver } from '@hookform/resolvers/zod';
import { WarningIcon } from '@phosphor-icons/react';
import { CaretUpDownIcon } from '@phosphor-icons/react/ssr';
import { addDays } from 'date-fns';
import { createInsertSchema } from 'drizzle-zod';
import { useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { InfoTip } from '@/components/info';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { invoices as invoicesSchema } from '@/db/schema';
import { createInvoice } from '@/lib/actions/invoice';
import type { getUserConfig } from '@/lib/data';
import { useClients, useInvoices } from '@/lib/hooks';
import { cn, type Prettify } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@/ui/combobox';
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
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from '@/ui/field';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { InvoiceItemsField, itemsArraySchema } from './invoiceItems';

const schema = createInsertSchema(invoicesSchema, {
	clientDataId: z.uuid({ error: 'Please select a client' }),
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
	notes: z
		.string()
		.optional()
		.transform(v => v?.trim())
		.transform(v => (v === '' ? undefined : v)),
	issuedAt: z.date({ error: 'Please enter an issue date' }),
	dueAt: z.date({ error: 'Please enter a due date' }),
})
	.pick({
		clientDataId: true,
		title: true,
		description: true,
		notes: true,
		issuedAt: true,
		dueAt: true,
		status: true,
	})
	.extend({ items: itemsArraySchema });

export function CreateInvoiceDialog({
	children,
	config,
}: {
	children: React.ReactNode;
	config: Prettify<
		Pick<
			Awaited<ReturnType<typeof getUserConfig>>,
			'id' | 'currency' | 'locale' | 'timezone' | 'taxes' | 'taxRegistration'
		>
	>;
}) {
	const [open, setOpen] = useState(false);
	const [formVersion, setFormVersion] = useState(0); // Reset counter
	const { mutate } = useInvoices();
	const { data: clientsData, isLoading: isClientsLoading, isError: isClientsError } = useClients();

	const { control, reset, handleSubmit, getValues } = useForm<z.input<typeof schema>>({
		resolver: zodResolver(schema),
		defaultValues: {
			clientDataId: '',
			items: [],
			title: '',
			description: '',
			status: 'unpaid',
			issuedAt: TZDate.tz(config.timezone),
			dueAt: addDays(TZDate.tz(config.timezone), 14),
		},
	});

	async function onSubmit({ items, ...invoice }: z.input<typeof schema>) {
		const data = {
			invoice,
			items: items.map(item => ({
				...item,
				taxes: item.taxes.entries().reduce((acc: string[], [id, status]) => {
					if (status) acc.push(id);
					return acc;
				}, []),
			})),
		};

		const result = createInvoice(data).then(() => {
			// This should really pass the action returned invoice, but that needs an identical shape to the fetcher
			mutate();
			setOpen(false);
			setFormVersion(v => v + 1);
			reset();
		});

		toast.promise(result, {
			loading: 'Creating invoice…',
			success: 'Invoice created',
			error: 'Failed to create invoice',
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger nativeButton={false} render={<span>{children}</span>} />

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
					<form onSubmit={handleSubmit(onSubmit)}>
						<FieldGroup className='gap-4'>
							<Controller
								name='clientDataId'
								control={control}
								render={({ field, fieldState }) => (
									<Field orientation='horizontal'>
										<FieldLabel
											htmlFor='clientId'
											className='-translate-y-1/2 !grow-0 mt-4.5 self-start'
										>
											Bill To
										</FieldLabel>
										<div className='flex grow flex-col items-end gap-1'>
											<Combobox
												items={
													clientsData?.map(client => ({
														value: client.data.scdId,
														label: client.data.name,
													})) || []
												}
												required
												disabled={isClientsLoading || isClientsError || !clientsData}
												{...field}
												onValueChange={field.onChange}
												id='clientId'
											>
												<ComboboxInput
													className={cn(
														'w-full max-w-80',
														isClientsLoading &&
															'*:has-disabled:cursor-wait *:has-disabled:opacity-100',
													)}
													placeholder='e.g. John Smith'
												/>
												<ComboboxContent>
													<ComboboxEmpty>No clients found.</ComboboxEmpty>
													<ComboboxList>
														{item => (
															<ComboboxItem key={item.value} value={item}>
																{item.label}
															</ComboboxItem>
														)}
													</ComboboxList>
												</ComboboxContent>
											</Combobox>

											{isClientsError && (
												<FieldError errors={[{ message: 'Failed to fetch clients' }]} />
											)}
											{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
										</div>
									</Field>
								)}
							/>
							<Controller
								name='title'
								control={control}
								render={({ field, fieldState }) => (
									<Field orientation='horizontal'>
										<FieldLabel
											htmlFor='title'
											className='-translate-y-1/2 !grow-0 mt-4.5 self-start'
										>
											Title
										</FieldLabel>
										<div className='flex grow flex-col items-end gap-1'>
											<Input id='title' placeholder='Optional' {...field} className='max-w-80' />
											{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
										</div>
									</Field>
								)}
							/>
						</FieldGroup>
						<details className='mt-6'>
							<Button
								size='sm'
								variant='ghost'
								className='!-ml-2.5 text-muted-foreground'
								nativeButton={false}
								render={
									<summary>
										Advanced <CaretUpDownIcon />
									</summary>
								}
							/>
							<FieldGroup className='mt-4 gap-4'>
								<Controller
									name='description'
									control={control}
									render={({ field, fieldState }) => (
										<Field orientation='responsive'>
											<FieldLabel
												htmlFor='description'
												className='@md/field-group:-translate-y-1/2 @md/field-group:mt-4.5 self-start'
											>
												Description
												<InfoTip side='right'>Printed below the invoice reference</InfoTip>
											</FieldLabel>
											<div className='flex flex-col gap-1'>
												<Textarea
													placeholder='Optional'
													{...field}
													className='@md/field-group:w-80'
												/>
												{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
											</div>
										</Field>
									)}
								/>
								<Controller
									name='notes'
									control={control}
									render={({ field, fieldState }) => (
										<Field orientation='responsive'>
											<FieldLabel
												htmlFor='notes'
												className='@md/field-group:-translate-y-1/2 @md/field-group:mt-4.5 self-start'
											>
												Notes
												<InfoTip side='right'>Your own private notes</InfoTip>
											</FieldLabel>
											<div className='flex flex-col gap-1'>
												<Textarea
													placeholder='Optional'
													{...field}
													className='@md/field-group:w-80'
												/>
												{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
											</div>
										</Field>
									)}
								/>

								<div className='mt-2 grid grid-cols-2 gap-3'>
									<Controller
										name='issuedAt'
										control={control}
										disabled
										render={({ field, fieldState }) => (
											<Field data-invalid={fieldState.invalid}>
												<FieldLabel htmlFor='issuedAt'>Date of issue</FieldLabel>
												<DatePicker
													className='min-w-0'
													id='issuedAt'
													startMonth={TZDate.tz(config.timezone)}
													timeZone={config.timezone}
													locale={config.locale}
													{...field}
												/>
												{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
											</Field>
										)}
									/>
									<Controller
										name='dueAt'
										control={control}
										render={({ field, fieldState }) => (
											<Field data-invalid={fieldState.invalid}>
												<FieldLabel htmlFor='dueAt'>Due date</FieldLabel>
												<DatePicker
													className='min-w-0'
													id='dueAt'
													disabledDays={[
														{ before: TZDate.tz(config.timezone) },
														TZDate.tz(config.timezone),
													]}
													startMonth={TZDate.tz(config.timezone)}
													timeZone={config.timezone}
													locale={config.locale}
													{...field}
												/>
												{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
											</Field>
										)}
									/>
								</div>
							</FieldGroup>
						</details>
						<FieldSeparator className='-mx-6 my-6'>Items</FieldSeparator>

						<InvoiceItemsField
							config={config}
							control={control}
							getValues={getValues}
							key={formVersion}
							className='mb-6'
						/>
					</form>

					<DialogFooter>
						<Button variant='primary' type='submit' onClick={handleSubmit(onSubmit)}>
							Submit
						</Button>
						<DialogClose
							className='order-first'
							onClick={() =>
								setTimeout(() => {
									setFormVersion(v => v + 1);
									reset();
								}, 200)
							}
							render={<Button variant='ghost'>Cancel</Button>}
						/>
					</DialogFooter>
				</ErrorBoundary>
			</DialogContent>
		</Dialog>
	);
}
