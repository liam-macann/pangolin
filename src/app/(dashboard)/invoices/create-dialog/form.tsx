'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useForm, useFormState } from 'react-hook-form';
import { Temporal } from 'temporal-polyfill';

import { createInvoice } from '@/lib/actions/invoice';
import { useInvoiceMutation } from '@/lib/hooks';

import { Button } from '@/ui/button';
import { FieldSeparator } from '@/ui/field';
import { DialogClose, DialogFooter } from '@/ui/responsive-dialog';
import { toast } from '@/ui/toast';

import { InvoiceDetails } from './details';
import { LineItemsField } from './line-items';
import { InvoiceOptions } from './options';
import { type CreateInvoiceDraft, schema } from './schema';
import { type CreateInvoiceConfig } from './types';

/** Controls the form state for {@link CreateInvoiceForm}. */
// Called above the dialog component, which unmounts on close, so that a draft outlives open state
export function useCreateInvoiceForm(config: Pick<CreateInvoiceConfig, 'timezone'>) {
	const [version, setVersion] = useState(0);
	const today = Temporal.Now.plainDateISO(config.timezone);

	const defaultValues: CreateInvoiceDraft = {
		clientDataId: '',
		items: [],
		title: '',
		description: '',
		status: 'unpaid',
		issuedAt: today,
		dueAt: today.add({ days: 14 }),
	};

	const { reset, ...form } = useForm({ resolver: zodResolver(schema), defaultValues });

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
