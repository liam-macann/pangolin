'use client';

import { type Control, Controller } from 'react-hook-form';
import type z from 'zod/v4';
import { AddressInput } from '@/components/address-input';
import type { config as formSchema } from '@/lib/validation/config';
import {
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLegend,
	FieldSet,
} from '@/ui/field';
import { PaymentDetailsField } from './paymentDetails';
import { RegistrationNumberField } from './registrationNumber';

type FormValues = z.input<typeof formSchema>;
type Fields = Pick<FormValues, 'registrationNumber' | 'paymentDetails' | 'address'>;

export function Details<T extends Fields>({ control: _control }: { control: Control<T> }) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<Fields>;

	return (
		<FieldGroup>
			<h2 className='font-bold text-2xl' id='details'>
				Your details
			</h2>

			<Controller
				name='registrationNumber'
				control={control}
				render={({ fieldState }) => (
					<FieldSet>
						<FieldContent>
							<FieldLegend className='flex items-center gap-2'>Trading number</FieldLegend>
							<FieldDescription>
								Business or charity identifiers, as required for tax and legal compliance.
							</FieldDescription>
							{fieldState.error?.root && <FieldError errors={[fieldState.error?.root]} />}
						</FieldContent>
						<RegistrationNumberField control={control} className='not-data-empty:-my-2' />
					</FieldSet>
				)}
			/>

			<Controller
				name='paymentDetails'
				control={control}
				render={({ fieldState }) => (
					<FieldSet>
						<FieldContent>
							<FieldLegend className='flex items-center gap-2'>Payment information</FieldLegend>
							<FieldDescription>
								Bank account numbers will be printed on the invoice footer. Please ensure details
								are accurate.
							</FieldDescription>
							{fieldState.error?.root && <FieldError errors={[fieldState.error?.root]} />}
						</FieldContent>
						<PaymentDetailsField control={control} className='not-data-empty:-my-2' />
					</FieldSet>
				)}
			/>

			<Controller
				name='address'
				control={control}
				render={({ fieldState }) => (
					<FieldSet className='mb-4 min-w-0'>
						<FieldContent>
							<FieldLegend className='flex items-center gap-2'>Address</FieldLegend>
							<FieldDescription>Billing address to be printed on invoices.</FieldDescription>
							{fieldState.error?.root && <FieldError errors={[fieldState.error?.root]} />}
						</FieldContent>
						<AddressInput control={control} />
					</FieldSet>
				)}
			/>
		</FieldGroup>
	);
}
