'use client';

import { type Control, Controller, useFormContext } from 'react-hook-form';
import type z from 'zod/v4';
import { InfoTip } from '@/components/info';
import { Checkbox } from '@/components/ui/checkbox';
import type { config as formSchema } from '@/lib/validation/config';
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
import { DuplicateWarning, TaxRateField } from './taxRates';

type FormValues = z.input<typeof formSchema>;
type Fields = Pick<FormValues, 'taxRegistration' | 'taxes'>;

export function Taxation<T extends Fields>({ control: _control }: { control: Control<T> }) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<Fields>;

	const { trigger } = useFormContext<Fields>();

	return (
		<FieldGroup>
			<h2 className='flex items-baseline gap-3 font-bold text-2xl' id='taxation'>
				Taxation
			</h2>

			<Controller
				name='taxRegistration'
				control={control}
				render={({ field, fieldState }) => {
					const { value, onChange, ...attrs } = field;
					const onCheckedChange = (checked: boolean) => {
						onChange(checked);
						trigger('taxes');
					};

					return (
						<Field orientation='horizontal' data-invalid={fieldState.invalid}>
							<Checkbox {...attrs} checked={value} onCheckedChange={onCheckedChange} id='tax' />
							<FieldContent>
								<FieldLabel htmlFor='tax'>I am registered for tax</FieldLabel>
								<FieldDescription className='text-muted-foreground text-sm'>
									We have no knowledge of tax obligations in your region, nor your individual tax
									situation. Please ensure you are compliant with local laws.
								</FieldDescription>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</FieldContent>
						</Field>
					);
				}}
			/>

			<Controller
				name='taxes'
				control={control}
				render={({ fieldState }) => (
					<FieldSet className='-mb-4 mt-4'>
						<FieldContent className='ml-8'>
							<FieldLegend className='flex items-center gap-2'>
								Tax rates
								<InfoTip side='right'>
									Taxes defined here will always be printed on invoices, even if no tax is
									applicable
								</InfoTip>
							</FieldLegend>
							<FieldDescription>
								When registered for tax, each rate can be applied on a per-item basis.
							</FieldDescription>
							{fieldState.error && <FieldError errors={[fieldState.error]} />}
						</FieldContent>

						{/* AnimatePresence doesn't work with gap; wrapper needed */}
						<div className='isolate'>
							<DuplicateWarning control={control} className='ml-8 pb-6' />
							<TaxRateField control={control} className='not-data-empty:-my-2 relative z-10' />
						</div>
					</FieldSet>
				)}
			/>
		</FieldGroup>
	);
}
