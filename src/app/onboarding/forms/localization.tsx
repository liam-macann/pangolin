'use client';

import { Combobox } from '@base-ui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { CurrencySelectCombobox, CurrencySelectRoot } from '@/components/currency-select';
import { RegionSelectCombobox, RegionSelectRoot } from '@/components/region-select';
import { TimezoneSelectCombobox, TimezoneSelectRoot } from '@/components/timezone-select';
import { Button } from '@/ui/button';
import { Field, FieldContent, FieldError, FieldGroup, FieldTitle } from '@/ui/field';

import { localization, useOnboardingStore } from '@/src/app/onboarding/state';
import { Footer, type Geo } from '@/src/app/onboarding/ui';

export function Localization({ geo }: { geo: Geo }) {
	const config = useOnboardingStore(state => state.config);

	const setFields = useOnboardingStore(state => state.setFields);
	const next = useOnboardingStore(state => state.next);

	const { control, handleSubmit } = useForm({
		resolver: zodResolver(localization),
		defaultValues: {
			timezone: config.timezone || geo.timezone || '',
			region: config.region || geo.country || '',
			currency: config.currency || geo.currency || '',
		},
	});

	return (
		<form
			onSubmit={handleSubmit(data => {
				setFields(data);
				next();
			})}
		>
			<h1 className='mb-6 font-bold text-xl'>Localisation</h1>

			<FieldGroup>
				<Controller
					name='timezone'
					control={control}
					render={({ field, fieldState }) => (
						<TimezoneSelectRoot {...field} onValueChange={v => field.onChange(v?.name)}>
							<Field
								orientation='responsive'
								className='items-center!'
								data-invalid={fieldState.invalid}
							>
								<FieldContent>
									<Combobox.Label render={<FieldTitle>Time zone</FieldTitle>} />
									<FieldError errors={[fieldState.error]} />
								</FieldContent>
								<TimezoneSelectCombobox className='min-w-72' />
							</Field>
						</TimezoneSelectRoot>
					)}
				/>

				<Controller
					name='region'
					control={control}
					render={({ field, fieldState }) => (
						<RegionSelectRoot {...field} onValueChange={v => field.onChange(v?.iso2)}>
							<Field
								orientation='responsive'
								className='items-center!'
								data-invalid={fieldState.invalid}
							>
								<FieldContent>
									<Combobox.Label render={<FieldTitle>Region</FieldTitle>} />
									<FieldError errors={[fieldState.error]} />
								</FieldContent>
								<RegionSelectCombobox className='min-w-72' />
							</Field>
						</RegionSelectRoot>
					)}
				/>

				<Controller
					name='currency'
					control={control}
					render={({ field, fieldState }) => (
						<CurrencySelectRoot {...field} onValueChange={v => field.onChange(v?.iso)}>
							<Field
								orientation='responsive'
								className='items-center!'
								data-invalid={fieldState.invalid}
							>
								<FieldContent>
									<Combobox.Label render={<FieldTitle>Currency</FieldTitle>} />
									<FieldError errors={[fieldState.error]} />
								</FieldContent>
								<CurrencySelectCombobox className='min-w-72' />
							</Field>
						</CurrencySelectRoot>
					)}
				/>
			</FieldGroup>

			<Footer next={<Button variant='primary' type='submit' />} />
		</form>
	);
}
