'use client';

import { TZDate } from '@date-fns/tz';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDays } from 'date-fns';
import { useState } from 'react';
import { FormProvider, useForm, useFormState } from 'react-hook-form';

import { createInvoice } from '@/lib/actions/invoice';
import { useInvoiceMutation } from '@/lib/hooks';
import { invoice as schema } from '@/lib/validation/invoice';

import { Button } from '@/ui/button';
import { FieldSeparator } from '@/ui/field';
import { DialogClose, DialogFooter } from '@/ui/responsive-dialog';
import { toast } from '@/ui/toast';

import { InvoiceDetails } from './details';
import { LineItemsField } from './line-items';
import { InvoiceOptions } from './options';
import { type CreateInvoiceConfig, type CreateInvoiceFormValues } from './types';

/** Controls the form state for {@link CreateInvoiceForm}. */
// Called above the dialog component, which unmounts on close, so that a draft outlives open state
export function useCreateInvoiceForm(config: Pick<CreateInvoiceConfig, 'timezone'>) {
	const [version, setVersion] = useState(0);

	const defaultValues = {
		clientDataId: '',
		items: [],
		title: '',
		description: '',
		status: 'unpaid' as const,
		issuedAt: TZDate.tz(config.timezone),
		dueAt: addDays(TZDate.tz(config.timezone), 14),
	};

	const { reset, ...form } = useForm<CreateInvoiceFormValues>({
		resolver: zodResolver(schema),
		defaultValues,
	});

	const triggerReset: typeof reset = (values = defaultValues, ...args) => {
		setVersion(version => version + 1);
		reset(values, ...args);
	};

	return { form: { ...form, reset: triggerReset }, version };
}

export function CreateInvoiceForm({
	config,
	form,
	version,
	onSuccess,
}: {
	config: CreateInvoiceConfig;
	onSuccess: () => void;
} & ReturnType<typeof useCreateInvoiceForm>) {
	const { mutateAsync } = useInvoiceMutation({ targetId: undefined, mutationFn: createInvoice });
	const { isSubmitting } = useFormState({ control: form.control });

	return (
		<FormProvider {...form}>
			<form
				onSubmit={form.handleSubmit(async data => {
					const promise = mutateAsync(data).then(() => {
						onSuccess();
						form.reset();
					});

					await toast.promise(promise, {
						loading: 'Creating invoice…',
						success: 'Invoice created',
						error: 'Failed to create invoice',
					});
				})}
			>
				<InvoiceDetails />
				<FieldSeparator className='-mx-6 my-6'>Items</FieldSeparator>
				<LineItemsField config={config} key={version} className='mb-6' />

				<DialogFooter className='flex-row-reverse!'>
					<Button variant='primary' type='submit' loading={isSubmitting}>
						Submit
					</Button>

					<DialogClose
						onClick={() => setTimeout(form.reset, 200)}
						render={<Button variant='ghost'>Cancel</Button>}
					/>

					<InvoiceOptions locale={config.locale} timezone={config.timezone} />
				</DialogFooter>
			</form>
		</FormProvider>
	);
}
