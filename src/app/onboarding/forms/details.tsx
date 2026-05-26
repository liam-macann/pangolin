'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/ui/button';
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

import { type Session } from '@/auth';
import { TradingNumberField } from '@/src/app/(dashboard)/(user)/settings/sections/details/trading-number';
import { details, useOnboardingStore } from '@/src/app/onboarding/state';

import { Footer } from './../ui';

export function Details({ session }: { session: Session }) {
	const config = useOnboardingStore(state => state.config);

	const setFields = useOnboardingStore(state => state.setFields);
	const next = useOnboardingStore(state => state.next);

	const {
		register,
		formState: { errors },
		control,
		handleSubmit,
	} = useForm({
		resolver: zodResolver(details),
		defaultValues: {
			tradingName: config.tradingName,
			email: config.email || session.user.email,
			tradingNumber: config.tradingNumber || [],
		},
	});

	return (
		<form
			onSubmit={handleSubmit(data => {
				setFields(data);
				next();
			})}
		>
			<h1 className='mb-6 font-bold text-xl'>Your details</h1>

			<FieldGroup>
				<Field orientation='horizontal' data-invalid={!!errors.tradingName}>
					<FieldContent>
						<FieldLabel htmlFor='tradingName'>Trading name</FieldLabel>
						{errors.tradingName && <FieldError errors={[errors.tradingName]} />}
					</FieldContent>
					<Input
						id='tradingName'
						{...register('tradingName')}
						aria-invalid={!!errors.tradingName}
						className='w-72'
					/>
				</Field>

				<Field orientation='horizontal' data-invalid={!!errors.email}>
					<FieldContent>
						<FieldLabel htmlFor='email'>Email</FieldLabel>
						<FieldDescription>Optional</FieldDescription>
						{errors.email && <FieldError errors={[errors.email]} />}
					</FieldContent>
					<Input id='email' {...register('email')} aria-invalid={!!errors.email} className='w-72' />
				</Field>

				<hr className='my-2' />

				<Controller
					name='tradingNumber'
					control={control}
					render={({ fieldState }) => (
						<FieldSet>
							<FieldContent>
								<FieldLegend variant='label'>Trading number</FieldLegend>
								<FieldDescription>
									Business or charity identifiers, as required for tax and legal compliance.
								</FieldDescription>
								<FieldError errors={[fieldState.error]} />
							</FieldContent>
							<TradingNumberField control={control} className='not-data-empty:-my-2' />
						</FieldSet>
					)}
				/>
			</FieldGroup>

			<Footer next={<Button variant='primary' type='submit' />} />
		</form>
	);
}
