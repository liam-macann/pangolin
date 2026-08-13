'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { WarningIcon } from '@phosphor-icons/react';
import { type ComponentProps, type ReactElement, type ReactNode, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
	type Control,
	Controller,
	FormProvider,
	type UseFormReturn,
	useForm,
	useFormState,
} from 'react-hook-form';
import z from 'zod/v4';

import { createClient, updateClient } from '@/lib/actions/client';
import { type Client } from '@/lib/data/client';
import { useClient, useClients } from '@/lib/hooks';
import { transform as addressTransformSchema } from '@/lib/validation/address';
import { clientDataCreate as createSchema, clientData as schema } from '@/lib/validation/client';

import { type FormValues as AddressFormValues, AddressInput } from '@/components/address-input';
import { Alert, AlertTitle } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/collapsible';
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
} from '@/ui/field';
import { Input } from '@/ui/input';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/ui/responsive-dialog';
import { Switch } from '@/ui/switch';
import { toast } from '@/ui/toast';

/** Uses local addressEnabled flag to toggle address validation, and drops it after parsing */
const formSchema = schema
	.safeExtend({
		address: addressTransformSchema.nullable(),
		addressEnabled: z.boolean(),
	})
	.transform(data => {
		if (!data.addressEnabled) return { ...data, address: null };
		return data;
	})
	.transform(({ addressEnabled, ...data }) => data as z.input<typeof schema>)
	.pipe(schema);

const createFormSchema = createSchema
	.safeExtend({
		address: addressTransformSchema.nullable(),
		addressEnabled: z.boolean(),
	})
	.transform(data => {
		if (!data.addressEnabled) return { ...data, address: null };
		return data;
	})
	.transform(({ addressEnabled, ...data }) => data as z.input<typeof createSchema>)
	.pipe(createSchema);

export function CreateClientDialog({
	children,
	...props
}: { children: ReactElement } & ComponentProps<typeof Dialog>) {
	const { mutate } = useClients();

	const form = useForm({
		resolver: zodResolver(createFormSchema),
		defaultValues: {
			name: '',
			email: '',
			address: null,
			addressEnabled: false,
		},
	});

	return (
		<ClientDialog
			title='Create client'
			form={form}
			onSubmit={async data => {
				const promise = createClient(data).then(() => void mutate());

				toast.promise(promise, {
					loading: 'Creating new client…',
					success: 'Client created',
					error: 'Failed to add new client',
				});

				return promise;
			}}
			{...props}
		>
			{children}
		</ClientDialog>
	);
}

export function UpdateClientDialog({
	children,
	defaultValues,
	...props
}: {
	children: ReactElement;
	defaultValues: Client;
} & ComponentProps<typeof Dialog>) {
	const { mutate: mutateClient } = useClient(defaultValues.id);

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: { ...defaultValues.data, addressEnabled: !!defaultValues.data.address },
	});

	return (
		<ClientDialog
			title='Update client'
			form={form}
			onSubmit={async data => {
				const promise = updateClient(data).then(() => void mutateClient());

				toast.promise(promise, {
					loading: 'Updating client details…',
					success: 'Client updated',
					error: 'Failed to update client',
				});

				return promise;
			}}
			{...props}
		>
			{children}
		</ClientDialog>
	);
}

type ClientDialog<TForm> = {
	title: ReactNode;
	children: ReactElement;

	// biome-ignore lint/suspicious/noExplicitAny: Specific shape irrelevant for conditional type
	form: TForm extends UseFormReturn<any, any, any> ? TForm : never;
	onSubmit: (
		// biome-ignore lint/suspicious/noExplicitAny: Specific shape irrelevant for conditional type
		data: TForm extends UseFormReturn<any, any, infer O> ? O : never,
		// biome-ignore lint/suspicious/noExplicitAny: Specific shape irrelevant for conditional type
		form: TForm extends UseFormReturn<any, any, any> ? TForm : never,
	) => Promise<void>;
};

/** Generic client dialog, reused for creation and updates */
// biome-ignore lint/suspicious/noExplicitAny: Field values differ between create and update forms (create omits clientId)
function ClientDialog<TForm extends UseFormReturn<any, unknown, any>>({
	title,
	form,
	onSubmit,
	children,
	...props
}: ClientDialog<TForm> & ComponentProps<typeof Dialog>) {
	const [open, setOpen] = useState(false);

	const { control, reset, handleSubmit } = form;

	// NOTE: Hook is necessary, as destructuring from `form` will not subscribe to state updates
	const { isSubmitting } = useFormState({ control });

	return (
		<FormProvider {...form}>
			<Dialog {...props} open={props.open ?? open} onOpenChange={setOpen}>
				<DialogTrigger render={children} />

				<DialogContent>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
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
							onSubmit={handleSubmit(data =>
								onSubmit(data, form).then(() => {
									setOpen(false);
									setTimeout(() => reset(data), 200);
								}),
							)}
						>
							<FieldGroup className='gap-4'>
								<Controller
									name='name'
									control={control}
									render={({ field, fieldState }) => (
										<Field orientation='horizontal' data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor='name'>Full Name</FieldLabel>
											<div className='flex basis-60 flex-col items-end gap-1 sm:basis-72'>
												<Input
													id='name'
													aria-invalid={fieldState.invalid}
													placeholder='e.g. Abiel Mancusi'
													{...field}
													value={field.value || ''}
												/>
												{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
											</div>
										</Field>
									)}
								/>

								<Controller
									name='organization'
									control={control}
									render={({ field, fieldState }) => (
										<Field orientation='horizontal' data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor='organization'>Organisation</FieldLabel>
											<div className='flex basis-60 flex-col items-end gap-1 sm:basis-72'>
												<Input
													id='organization'
													aria-invalid={fieldState.invalid}
													placeholder='e.g. Acme Inc.'
													{...field}
													value={field.value || ''}
												/>
												{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
											</div>
										</Field>
									)}
								/>

								<Controller
									name='email'
									control={control}
									render={({ field, fieldState }) => (
										<Field orientation='horizontal' data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor='email'>Email</FieldLabel>
											<div className='flex basis-60 flex-col items-end gap-1 sm:basis-72'>
												<Input
													id='email'
													aria-invalid={fieldState.invalid}
													placeholder='abiel@mancusi.com'
													{...field}
												/>
												{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
											</div>
										</Field>
									)}
								/>

								<FieldSeparator className='-mx-6 my-2' />

								<FieldSet>
									<Controller
										name='addressEnabled'
										control={control}
										render={({
											field: { value: enabledValue, onChange: enabledOnChange, ...enabledField },
											fieldState: enabledState,
										}) => (
											<Collapsible open={enabledValue}>
												<FieldLegend>
													<CollapsibleTrigger
														render={<FieldLabel />}
														nativeButton={false}
														tabIndex={-1}
													>
														<Field>
															<span className='flex items-center gap-2'>
																<Switch
																	size='sm'
																	{...enabledField}
																	checked={enabledValue}
																	onCheckedChange={enabledOnChange}
																/>
																Billing address
															</span>
															{enabledState.error && <FieldError errors={[enabledState.error]} />}
														</Field>
													</CollapsibleTrigger>
												</FieldLegend>
												<CollapsibleContent>
													<FieldGroup>
														<Controller
															name='address'
															control={control}
															render={({ fieldState }) => (
																<>
																	<AddressInput
																		control={control as unknown as Control<AddressFormValues>}
																	/>
																	{fieldState.error && <FieldError errors={[fieldState.error]} />}
																</>
															)}
														/>
													</FieldGroup>
												</CollapsibleContent>
											</Collapsible>
										)}
									/>
								</FieldSet>
							</FieldGroup>

							<DialogFooter className='justify-start! mt-6 flex-row-reverse!'>
								<Button variant='primary' type='submit' disabled={isSubmitting}>
									Submit
								</Button>
								<DialogClose
									onClick={() => setTimeout(() => reset(), 200)}
									render={<Button variant='ghost'>Cancel</Button>}
									disabled={isSubmitting}
								/>
							</DialogFooter>
						</form>
					</ErrorBoundary>
				</DialogContent>
			</Dialog>
		</FormProvider>
	);
}
