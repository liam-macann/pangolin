'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, FormProvider, useForm } from 'react-hook-form';

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
import { Switch } from '@/ui/switch';

import { TaxRateField } from '@/src/app/(dashboard)/settings/sections/taxation/tax-rates';
import { taxation, useOnboardingStore } from '@/src/app/onboarding/state';
import { Footer } from '@/src/app/onboarding/ui';

export function Taxation() {
	const config = useOnboardingStore(state => state.config);

	const setFields = useOnboardingStore(state => state.setFields);
	const next = useOnboardingStore(state => state.next);

	const form = useForm({
		resolver: zodResolver(taxation),
		defaultValues: {
			taxRegistration: config.taxRegistration ?? true,
			taxes: config.taxes || [],
		},
	});

	return (
		<FormProvider {...form}>
			<form
				onSubmit={form.handleSubmit(data => {
					setFields(data);
					next();
				})}
			>
				<h1 className='mb-2 font-bold text-xl'>Taxation</h1>

				<p className='mb-6 text-balance text-muted-foreground'>
					Automatically calculate how much tax is owed on your invoices.
				</p>

				<FieldGroup>
					<Controller
						name='taxRegistration'
						control={form.control}
						render={({ field, fieldState }) => {
							const { value, onChange, ...attrs } = field;
							const onCheckedChange = (checked: boolean) => {
								onChange(checked);
								form.trigger('taxes');
							};

							return (
								<FieldLabel htmlFor='tax'>
									<Field orientation='horizontal' data-invalid={fieldState.invalid}>
										<Switch {...attrs} checked={value} onCheckedChange={onCheckedChange} id='tax' />
										<FieldContent>
											I am registered for tax
											<FieldError errors={[fieldState.error]} />
										</FieldContent>
									</Field>
								</FieldLabel>
							);
						}}
					/>

					<Controller
						name='taxes'
						control={form.control}
						render={({ fieldState }) => (
							<FieldSet>
								<FieldContent>
									<FieldLegend>Tax rates</FieldLegend>
									<FieldDescription>
										We recommend setting up taxes regardless of your registration status.
									</FieldDescription>
									<FieldError errors={[fieldState.error]} />
								</FieldContent>
								<TaxRateField control={form.control} className='not-data-empty:-my-2' />
							</FieldSet>
						)}
					/>
				</FieldGroup>

				<Footer next={<Button variant='primary' type='submit' />} />
			</form>
		</FormProvider>
	);
}
