'use client';

import { Combobox } from '@base-ui/react';
import { type Control, Controller } from 'react-hook-form';
import type z from 'zod/v4';

import { type config as formSchema } from '@/lib/validation/config';

import { CurrencySelectCombobox, CurrencySelectRoot } from '@/components/currency-select';
import { InfoTip } from '@/components/info';
import { RegionSelectCombobox, RegionSelectRoot } from '@/components/region-select';
import { TimezoneSelectCombobox, TimezoneSelectRoot } from '@/components/timezone-select';
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldTitle,
} from '@/ui/field';

type FormValues = z.input<typeof formSchema>;
type Fields = Pick<FormValues, 'region' | 'timezone' | 'currency'>;

export function Localization<T extends Fields>({ control: _control }: { control: Control<T> }) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<Fields>;

	return (
		<FieldGroup>
			<h2 className='flex items-baseline gap-3 font-bold text-2xl' id='localisation'>
				Localisation
				<InfoTip side='right'>
					Existing invoices will not be affected by changes to localisation
				</InfoTip>
			</h2>
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
								<FieldDescription>
									Adjust formatting of dates, times, and numbers to reflect your locale.
								</FieldDescription>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</FieldContent>
							<RegionSelectCombobox />
						</Field>
					</RegionSelectRoot>
				)}
			/>
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
								<FieldDescription>
									Your time zone of record, which affects the time displayed in your invoices and
									summary data.
								</FieldDescription>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</FieldContent>
							<TimezoneSelectCombobox />
						</Field>
					</TimezoneSelectRoot>
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
								<FieldDescription>
									The currency will be displayed on invoices if different from locale.
								</FieldDescription>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</FieldContent>
							<CurrencySelectCombobox />
						</Field>
					</CurrencySelectRoot>
				)}
			/>
		</FieldGroup>
	);
}
