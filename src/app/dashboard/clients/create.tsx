'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { WarningIcon } from '@phosphor-icons/react';
import { type ReactElement, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { createClient } from '@/lib/actions/client';
import { useClients } from '@/lib/hooks';
import { clientData as schema } from '@/lib/validation/client';

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
	const [open, setOpen] = useState(false);
	const { mutate } = useClients();

	const methods = useForm({
		resolver: zodResolver(schema.omit({ clientId: true })),
		defaultValues: {
			name: '',
			email: '',
		},
	});

	const {
		control,
		reset,
		handleSubmit,
		formState: { isSubmitting },
	} = methods;

	return (
		<FormProvider {...methods}>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger render={children} />

				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create client</DialogTitle>
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
								const promise = createClient(data).then(() => {
									// This should really pass the action returned client, but that needs an identical shape to the fetcher
									mutate();
									setOpen(false);
									reset();
								});

								toast.promise(promise, {
									loading: 'Creating new client…',
									success: 'Client created',
									error: 'Failed to add new client',
								});
							})}
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
								/>
							</DialogFooter>
						</form>
					</ErrorBoundary>
				</DialogContent>
			</Dialog>
		</FormProvider>
	);
}
