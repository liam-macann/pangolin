'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { WarningIcon } from '@phosphor-icons/react';
import { type ReactElement, type ReactNode, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
	type Control,
	Controller,
	type FieldValues,
	FormProvider,
	type UseFormReturn,
	useForm,
	useFormState,
} from 'react-hook-form';
import { toast } from 'sonner';
import type z from 'zod/v4';

import { createClient, updateClient } from '@/lib/actions/client';
import { useClient, useClients } from '@/lib/hooks';
import { clientData as formSchema } from '@/lib/validation/client';

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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';

export function CreateClientDialog({ children }: { children: ReactElement }) {
	const { mutate } = useClients();

	const form = useForm({
		resolver: zodResolver(formSchema.omit({ clientId: true })),
		defaultValues: {
			name: '',
			email: '',
		},
	});

	return (
		<ClientDialog
			title={'Create client'}
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
	defaultValues: z.infer<typeof formSchema>;
}) {
	const { mutate: mutateClients } = useClients();
	const { mutate: mutateClient } = useClient(defaultValues.clientId);

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues,
	});

	return (
		<ClientDialog
			title={'Update client'}
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

/** Fields set by the user, excluding ids etc. */
type FormFields = Omit<z.infer<typeof formSchema>, 'clientId'>;
type ClientDialog<T extends FieldValues> = {
	title: ReactNode;
	children: ReactElement;

	form: UseFormReturn<T>;
	onSubmit: (data: T, form: UseFormReturn<T>) => Promise<void>;
};

function ClientDialog<T extends FormFields>({ title, form, onSubmit, children }: ClientDialog<T>) {
	const [open, setOpen] = useState(false);

	const { control: _control, reset, handleSubmit } = form;

	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<FormFields>;

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
