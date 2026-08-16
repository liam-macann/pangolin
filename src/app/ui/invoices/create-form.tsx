'use client';

import { TZDate } from '@date-fns/tz';
import { zodResolver } from '@hookform/resolvers/zod';
import { DotsThreeIcon, WarningIcon } from '@phosphor-icons/react';
import { CaretUpDownIcon } from '@phosphor-icons/react/ssr';
import { addDays } from 'date-fns';
import { type ComponentProps, type ReactElement, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { type Control, Controller, useForm } from 'react-hook-form';
import { type z } from 'zod';

import { type Config } from '@/api/dto/config';
import { createInvoice } from '@/lib/actions/invoice';
import { useClients, useInvoices } from '@/lib/hooks';
import { cn, type Simplify } from '@/lib/utils';
import { formatDate } from '@/lib/utils/date';
import { invoice as schema } from '@/lib/validation/invoice';

import { InfoTip } from '@/components/info';
import { Alert, AlertTitle } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Calendar } from '@/ui/calendar';
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@/ui/combobox';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubContentTextarea,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from '@/ui/field';
import { Input } from '@/ui/input';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/ui/responsive-dialog';
import { Textarea } from '@/ui/textarea';
import { toast } from '@/ui/toast';

import { LineItemsField } from './line-items';

export function CreateInvoiceDialog({
	children,
	config,
	...props
}: {
	children: ReactElement;
	config: Simplify<
		Pick<Config, 'id' | 'currency' | 'locale' | 'timezone' | 'taxes' | 'taxRegistration'>
	>;
} & ComponentProps<typeof Dialog>) {
	const [open, setOpen] = useState(false);
	const [formVersion, setFormVersion] = useState(0); // Reset counter
	const { mutate } = useInvoices();

	const { control, reset, handleSubmit, getValues } = useForm({
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
					<form
						onSubmit={handleSubmit(data => {
							const promise = createInvoice(data).then(() => {
								// This should really pass the action returned invoice, but that needs an identical shape to the fetcher
								mutate();
								setOpen(false);
								setFormVersion(v => v + 1);
								reset();
							});

							toast.promise(promise, {
								loading: 'Creating invoice…',
								success: 'Invoice created',
								error: 'Failed to create invoice',
							});
						})}
					>
						<FieldGroup className='gap-4'>
							<BillTo control={control} />

							<Controller
								name='title'
								control={control}
								render={({ field, fieldState }) => (
									<Field orientation='horizontal'>
										<FieldLabel
											htmlFor='title'
											className='mt-4.5 grow-0! -translate-y-1/2 self-start'
										>
											Title
										</FieldLabel>
										<div className='flex grow flex-col items-end gap-1'>
											<Input
												id='title'
												placeholder='Optional'
												{...field}
												value={field.value ?? ''}
												className='max-w-80'
											/>
											{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
										</div>
									</Field>
								)}
							/>
						</FieldGroup>
						<details className='mt-4'>
							<Button
								size='sm'
								variant='ghost'
								className='-ml-3! text-muted-foreground'
								nativeButton={false}
								render={
									<summary>
										More <CaretUpDownIcon />
									</summary>
								}
							/>
							<FieldGroup className='gap-4'>
								<Controller
									name='description'
									control={control}
									render={({ field, fieldState }) => (
										<Field orientation='responsive'>
											<FieldLabel
												htmlFor='description'
												className='@md/field-group:mt-4.5 @md/field-group:-translate-y-1/2 self-start'
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
							</FieldGroup>
						</details>
						<FieldSeparator className='-mx-6 my-6'>Items</FieldSeparator>

						<LineItemsField
							config={config}
							control={control}
							getValues={getValues}
							key={formVersion}
							className='mb-6'
						/>

						<DialogFooter className='flex-row-reverse!'>
							<Button variant='primary' type='submit'>
								Submit
							</Button>
							<DialogClose
								onClick={() =>
									setTimeout(() => {
										setFormVersion(v => v + 1);
										reset();
									}, 200)
								}
								render={<Button variant='ghost'>Cancel</Button>}
							/>

							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button variant='ghost' size='icon' className='mr-auto'>
											<DotsThreeIcon weight='bold' />
										</Button>
									}
								/>

								<DropdownMenuContent side='left' align='end' className='w-auto'>
									<NotesSubmenu control={control} />
									<DropdownMenuSeparator />
									<IssueDateSubmenu
										timezone={config.timezone}
										locale={config.locale}
										control={control}
									/>
									<DueDateSubmenu
										timezone={config.timezone}
										locale={config.locale}
										control={control}
									/>
								</DropdownMenuContent>
							</DropdownMenu>
						</DialogFooter>
					</form>
				</ErrorBoundary>
			</DialogContent>
		</Dialog>
	);
}

function BillTo({ control }: { control: Control<z.input<typeof schema>> }) {
	const { data: clientsData, isLoading: isClientsLoading, error: isClientsError } = useClients();

	const items = (clientsData || []).map(client => ({
		value: client.data.scdId,
		label: client.data.name || client.data.organization,
	}));

	return (
		<Controller
			name='clientDataId'
			control={control}
			render={({ field, fieldState }) => (
				<Field orientation='horizontal'>
					<FieldLabel htmlFor='clientId' className='mt-4.5 grow-0! -translate-y-1/2 self-start'>
						Bill To
					</FieldLabel>
					<div className='flex grow flex-col items-end gap-1'>
						<Combobox
							id='clientId'
							items={items}
							disabled={isClientsLoading || !!isClientsError || !clientsData}
							{...field}
							value={items.find(i => i.value === (field.value || '')) || null}
							onValueChange={v => field.onChange(v?.value)}
						>
							<ComboboxInput
								className={cn(
									'w-full max-w-80',
									isClientsLoading && '*:has-disabled:cursor-wait *:has-disabled:opacity-100',
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

						{!!isClientsError && <FieldError errors={[{ message: 'Failed to fetch clients' }]} />}
						{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
					</div>
				</Field>
			)}
		/>
	);
}

function NotesSubmenu({ control }: { control: Control<z.input<typeof schema>> }) {
	return (
		<Controller
			name='notes'
			control={control}
			render={({ field, fieldState }) => (
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<div className='grid'>
							<span>Notes</span>
							{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
						</div>
					</DropdownMenuSubTrigger>

					<DropdownMenuSubContent>
						<DropdownMenuSubContentTextarea {...field} label='Your private notes' />
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			)}
		/>
	);
}

function IssueDateSubmenu({
	control,
	timezone,
	locale,
}: {
	control: Control<z.input<typeof schema>>;
	timezone: string;
	locale: string;
}) {
	return (
		<Controller
			name='issuedAt'
			control={control}
			render={({ field, fieldState }) => (
				<DropdownMenuSub disabled>
					<DropdownMenuSubTrigger disabled>
						<div className='grid'>
							<span>Date of issue</span>
							{field.value && (
								<span className='text-muted-foreground text-xs'>
									{formatDate(new TZDate(field.value, timezone), { locale })}
								</span>
							)}
							{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
						</div>
					</DropdownMenuSubTrigger>
					<DropdownMenuPortal>
						<DropdownMenuSubContent>
							<Calendar
								id='issuedAt'
								className='min-w-0 p-1'
								mode='single'
								selected={field.value}
								defaultMonth={field.value}
								timeZone={timezone}
								{...field}
								onSelect={v => field.onChange(v)}
								disabled
							/>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>
			)}
		/>
	);
}

function DueDateSubmenu({
	control,
	timezone,
	locale,
}: {
	control: Control<z.input<typeof schema>>;
	timezone: string;
	locale: string;
}) {
	return (
		<Controller
			name='dueAt'
			control={control}
			render={({ field, fieldState }) => (
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<div className='grid'>
							<span>Due date</span>
							<span className='text-muted-foreground text-xs'>
								{formatDate(new TZDate(field.value, timezone), { locale })}
							</span>
							{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
						</div>
					</DropdownMenuSubTrigger>
					<DropdownMenuPortal>
						<DropdownMenuSubContent>
							<Calendar
								autoFocus
								id='dueAt'
								className='min-w-0 p-1'
								mode='single'
								selected={field.value}
								defaultMonth={field.value}
								disabled={[{ before: TZDate.tz(timezone) }, TZDate.tz(timezone)]}
								startMonth={TZDate.tz(timezone)}
								timeZone={timezone}
								{...field}
								onSelect={v => field.onChange(v)}
							/>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>
			)}
		/>
	);
}
