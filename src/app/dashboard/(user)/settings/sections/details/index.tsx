'use client';

import { type ReactNode } from 'react';
import { type Control, Controller, type UseFormReturn, useFormContext } from 'react-hook-form';
import type z from 'zod/v4';

import { type config as formSchema } from '@/lib/validation/config';

import { AddressInput } from '@/components/address-input';
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@/ui/field';
import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';
import { Textarea } from '@/ui/textarea';

import { PaymentDetailsField } from './paymentDetails';
import { RegistrationNumberField } from './registrationNumber';

type FormValues = z.input<typeof formSchema>;
type Fields = Pick<
	FormValues,
	'tradingName' | 'email' | 'phone' | 'header' | 'registrationNumber' | 'paymentDetails' | 'address'
> & { addressEnabled: boolean };

export function Details<T extends Fields>({ control: _control }: { control: Control<T> }) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<Fields>;

	return (
		<FieldGroup>
			<h2 className='font-bold text-2xl' id='details'>
				Your details
			</h2>

			<Controller
				name='tradingName'
				control={control}
				render={({ field, fieldState }) => (
					<Field orientation='responsive' data-invalid={fieldState.invalid}>
						<FieldContent>
							<FieldLabel htmlFor='tradingName'>Trading name</FieldLabel>
							<FieldDescription>The name by which your business is known.</FieldDescription>
							{fieldState.error && <FieldError errors={[fieldState.error]} />}
						</FieldContent>
						<Input
							id='tradingName'
							{...field}
							className='@xl/field-group:!w-96 @md/field-group:!w-72 max-w-full'
						/>
					</Field>
				)}
			/>

			<Controller
				name='email'
				control={control}
				render={({ field, fieldState }) => (
					<Field orientation='responsive' data-invalid={fieldState.invalid}>
						{!fieldState.error ? (
							<FieldLabel htmlFor='email'>Email address</FieldLabel>
						) : (
							<FieldContent>
								<FieldLabel htmlFor='email'>Email address</FieldLabel>
								<FieldError errors={[fieldState.error]} />
							</FieldContent>
						)}
						<Input
							id='email'
							{...field}
							className='@xl/field-group:!w-96 @md/field-group:!w-72 max-w-full'
							placeholder='Optional'
						/>
					</Field>
				)}
			/>

			<Controller
				name='phone'
				control={control}
				render={({ field, fieldState }) => (
					<Field orientation='responsive' data-invalid={fieldState.invalid}>
						{!fieldState.error ? (
							<FieldLabel htmlFor='phone'>Phone number</FieldLabel>
						) : (
							<FieldContent>
								<FieldLabel htmlFor='phone'>Phone number</FieldLabel>
								<FieldError errors={[fieldState.error]} />
							</FieldContent>
						)}
						<Input
							id='phone'
							{...field}
							className='@xl/field-group:!w-96 @md/field-group:!w-72 max-w-full'
							placeholder='Optional'
						/>
					</Field>
				)}
			/>

			<Controller
				name='header'
				control={control}
				render={({ field, fieldState }) => (
					<Field orientation='responsive' data-invalid={fieldState.invalid}>
						<FieldContent>
							<FieldLabel htmlFor='header'>Additional text</FieldLabel>
							<FieldDescription className='text-balance'>
								Further information for the first page of each invoice.
							</FieldDescription>
							{fieldState.error && <FieldError errors={[fieldState.error]} />}
						</FieldContent>

						<Textarea
							id='header'
							{...field}
							className='@xl/field-group:!w-96 @md/field-group:!w-72 max-w-full'
							placeholder='Optional'
						/>
					</Field>
				)}
			/>

			<hr className='my-3' />

			<ConnectForm>
				{({ clearErrors }) => (
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
										<FieldLegend className='mb-0 flex items-center gap-2'>
											<Switch
												id='addressEnabled'
												{...enabledField}
												checked={enabledValue}
												onCheckedChange={val => {
													enabledOnChange(val);
													if (!val) clearErrors('address');
												}}
											/>
											<label htmlFor='addressEnabled'>Billing address</label>
										</FieldLegend>
										{enabledFieldState.error && <FieldError errors={[enabledFieldState.error]} />}
									</FieldContent>

									<FieldDescription>Address to be printed on invoices.</FieldDescription>

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
				)}
			</ConnectForm>

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
							{fieldState.error && <FieldError errors={[fieldState.error]} />}
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
							{fieldState.error && <FieldError errors={[fieldState.error]} />}
						</FieldContent>
						<PaymentDetailsField control={control} className='not-data-empty:-my-2' />
					</FieldSet>
				)}
			/>
		</FieldGroup>
	);
}

export const ConnectForm = ({
	children,
}: {
	children: (props: UseFormReturn<FormValues>) => ReactNode;
}) => {
	const methods = useFormContext<FormValues>();
	return children(methods);
};
