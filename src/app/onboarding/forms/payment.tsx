'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/ui/button';
import { FieldContent, FieldError, FieldGroup, FieldSet } from '@/ui/field';

import { PaymentDetailsField } from '@/src/app/(dashboard)/settings/sections/details/payment-details';
import { payment, useOnboardingStore } from '@/src/app/onboarding/state';
import { Footer } from '@/src/app/onboarding/ui';

export function Payment() {
	const config = useOnboardingStore(state => state.config);

	const setFields = useOnboardingStore(state => state.setFields);
	const next = useOnboardingStore(state => state.next);

	const { control, handleSubmit } = useForm({
		resolver: zodResolver(payment),
		defaultValues: {
			paymentDetails: config.paymentDetails || [{ label: '', value: '' }],
		},
	});

	return (
		<form
			onSubmit={handleSubmit(data => {
				setFields(data);
				next();
			})}
		>
			<h1 className='mb-2 font-bold text-xl'>Payment information</h1>

			<p className='mb-4 text-muted-foreground'>
				Bank account numbers will be printed on the invoice footer.
			</p>

			<FieldGroup>
				<Controller
					name='paymentDetails'
					control={control}
					render={({ fieldState }) => (
						<FieldSet>
							<FieldContent>
								{fieldState.error && <FieldError errors={[fieldState.error]} />}
							</FieldContent>
							<PaymentDetailsField control={control} className='not-data-empty:-my-2' />
						</FieldSet>
					)}
				/>
			</FieldGroup>

			<Footer next={<Button variant='primary' type='submit' />} />
		</form>
	);
}
