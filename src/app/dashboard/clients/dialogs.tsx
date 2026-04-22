'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { WarningIcon } from '@phosphor-icons/react';
import { type ReactElement, type ReactNode, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
	Controller,
	FormProvider,
	type UseFormReturn,
	useForm,
	useFormState,
} from 'react-hook-form';
import { toast } from 'sonner';
import z from 'zod/v4';

import { createClient, updateClient } from '@/lib/actions/client';
import { useClient, useClients } from '@/lib/hooks';
import { transform as addressTransformSchema } from '@/lib/validation/address';
import { clientData as schema } from '@/lib/validation/client';

import { AddressInput } from '@/components/address-input';
import { Alert, AlertTitle } from '@/ui/alert';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/ui/dialog';
import {
	Field,
	FieldContent,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@/ui/field';
import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';

/** Uses local addressEnabled flag to toggle address validation, and drops it after parsing */
const formSchema = schema
	.extend({
		address: addressTransformSchema.nullable(),
		addressEnabled: z.boolean(),
	})
	.transform(data => {
		if (!data.addressEnabled) return { ...data, address: null };
		return data;
	})
	.transform(({ addressEnabled, ...data }) => data as z.input<typeof schema>)
	.pipe(schema);

export function CreateClientDialog({ children }: { children: ReactElement }) {
	const { mutate } = useClients();

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: '',
			email: '',
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
		>
			{children}
		</ClientDialog>
	);
}

export function UpdateClientDialog({
	children,
	defaultValues,
}: {
	children: ReactElement;
	defaultValues: Omit<z.input<typeof formSchema>, 'addressEnabled'>;
}) {
	const { mutate: mutateClients } = useClients();
	const { mutate: mutateClient } = useClient(defaultValues.clientId);

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: { ...defaultValues, addressEnabled: !!defaultValues.address },
	});

	return (
		<ClientDialog
			title='Update client'
			form={form}
			onSubmit={async data => {
				const promise = updateClient(data).then(() => {
					mutateClient();
					mutateClients();
				});

				toast.promise(promise, {
					loading: 'Updating client details…',
					success: 'Client updated',
					error: 'Failed to update client',
				});

				return promise;
			}}
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
// biome-ignore lint/suspicious/noExplicitAny: Return type need not be known within this component. Types are inferred for callback props.
function ClientDialog<TForm extends UseFormReturn<z.input<typeof formSchema>, unknown, any>>({
	title,
	form,
	onSubmit,
	children,
}: ClientDialog<TForm>) {
	const [open, setOpen] = useState(false);

	const { control, reset, handleSubmit, clearErrors } = form;

	// NOTE: Hook is necessary, as destructuring from `form` will not subscribe to state updates
	const { isSubmitting } = useFormState({ control });

	return (
		<FormProvider {...form}>
			<Dialog open={open} onOpenChange={setOpen}>
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

								<Controller
									name='addressEnabled'
									control={control}
									render={({
										field: { value: enabledValue, onChange: enabledOnChange, ...enabledField },
										fieldState: enabledFieldState,
									}) => (
										<FieldSet className='mb-4 min-w-0'>
											<FieldContent>
												<FieldContent>
													<FieldLegend variant='label' className='mb-0 flex items-center gap-2'>
														<Switch
															id='addressEnabled'
															{...enabledField}
															checked={enabledValue}
															onCheckedChange={val => {
																enabledOnChange(val);
																if (!val) clearErrors('address');
															}}
														/>
														<label htmlFor='addressEnabled'>Address</label>
													</FieldLegend>
													{enabledFieldState.error && (
														<FieldError errors={[enabledFieldState.error]} />
													)}
												</FieldContent>

												<Controller
													name='address'
													control={control}
													render={({ fieldState }) => (
														<>{fieldState.error && <FieldError errors={[fieldState.error]} />}</>
													)}
												/>
											</FieldContent>
											<AddressInput disabled={!enabledValue} control={control} />
										</FieldSet>
									)}
								/>
							</FieldGroup>

							<DialogFooter className='!flex-row-reverse !justify-start mt-6'>
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
