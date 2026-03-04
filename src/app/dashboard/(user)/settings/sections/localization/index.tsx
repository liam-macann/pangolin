'use client';

import { type Control, Controller } from 'react-hook-form';
import type z from 'zod/v4';
import { CurrencySelect } from '@/components/currency-select';
import { InfoTip } from '@/components/info';
import { RegionSelect } from '@/components/region-select';
import { TimezoneSelect } from '@/components/timezone-select';
import type { config as formSchema } from '@/lib/validation/config';
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
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
					<Field
						orientation='responsive'
						className='!items-center'
						data-invalid={fieldState.invalid}
					>
						<FieldContent>
							<FieldLabel htmlFor='region'>Region</FieldLabel>
							<FieldDescription>
								Adjust formatting of dates, times, and numbers to reflect your locale.
							</FieldDescription>
							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
						</FieldContent>
						<RegionSelect {...field} onValueChange={v => field.onChange(v?.iso2)} />
					</Field>
				)}
			/>
			<Controller
				name='timezone'
				control={control}
				render={({ field, fieldState }) => (
					<Field
						orientation='responsive'
						className='!items-center'
						data-invalid={fieldState.invalid}
					>
						<FieldContent>
							<FieldLabel htmlFor='timezone'>Time zone</FieldLabel>
							<FieldDescription>
								Your time zone of record, which affects the time displayed in your invoices and
								summary data.
							</FieldDescription>
							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
						</FieldContent>
						<TimezoneSelect id='timezone' {...field} onValueChange={v => field.onChange(v?.name)} />
					</Field>
				)}
			/>
			<Controller
				name='currency'
				control={control}
				render={({ field, fieldState }) => (
					<Field
						orientation='responsive'
						className='!items-center'
						data-invalid={fieldState.invalid}
					>
						<FieldContent>
							<FieldLabel htmlFor='currency'>Currency</FieldLabel>
							<FieldDescription>
								The currency will be displayed on invoices if different from locale.
							</FieldDescription>
							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
						</FieldContent>
						<CurrencySelect {...field} onValueChange={v => field.onChange(v?.iso)} />
					</Field>
				)}
			/>
		</FieldGroup>
	);
}
