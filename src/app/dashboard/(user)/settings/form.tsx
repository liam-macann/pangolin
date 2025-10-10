'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { InfoIcon } from '@phosphor-icons/react/ssr';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { getUserConfig } from '@/lib/data';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Combobox } from '@/ui/combobox';
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@/ui/field';
import { TextTooltip, Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { TaxRateField } from './taxRates';

const formSchema = z.object({
	taxes: z.array(
		z.object({
			name: z.string().min(2, { message: 'Label must be at least 2 characters' }),
			rate: z.preprocess(
				(val, ctx) => {
					if (val === '') {
						ctx.issues.push({ code: 'custom', message: 'Please enter a rate', input: val });
						return z.NEVER;
					}
					return val;
				},
				z.coerce
					.number('Tax rate must be a number')
					.multipleOf(0.01, 'You may only define up to two decimal places')
					.min(0, 'Negative taxes are not allowed')
					.max(200, 'Tax may not exceed 200%'),
			),
		}),
	),
	timezone: z.string(),
	locale: z.string(),
	currency: z.string(),
	taxRegistration: z.boolean(),
});

export default function ConfigForm({
	config,
}: {
	config: Awaited<ReturnType<typeof getUserConfig>>;
}) {
	const form = useForm<z.input<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			taxRegistration: config.taxRegistration,
			taxes: config.user.tax.map(t => ({ ...t, rate: String(t.rate * 100), committed: true })),
			timezone: config.timezone,
			locale: config.locale,
			currency: config.currency,
		},
	});

	const {
		formState: { isDirty },
		handleSubmit,
		control,
	} = form;

	return (
		<form className='grid gap-12' onSubmit={handleSubmit(val => console.log(val))}>
			<FieldGroup>
				<h2 className='flex items-baseline gap-3 font-bold text-2xl' id='taxation'>
					Taxation
				</h2>

				<Controller
					name='taxRegistration'
					control={control}
					rules={{ required: true }}
					render={({ field, fieldState }) => {
						const { value, ...attrs } = field;
						return (
							<Field orientation='horizontal' data-invalid={fieldState.invalid}>
								<Checkbox {...attrs} checked={value} onCheckedChange={field.onChange} id='tax' />
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

				<TaxRateField form={form} className='mt-4' />
			</FieldGroup>

			<FieldGroup>
				<h2 className='flex items-baseline gap-3 font-bold text-2xl' id='localisation'>
					Localisation
					<Tooltip>
						<TooltipTrigger className='translate-y-px rounded-full'>
							<InfoIcon className='size-4' />
						</TooltipTrigger>
						<TooltipContent side='right' sideOffset={0}>
							Existing invoices will not be affected by changes to localisation.
						</TooltipContent>
					</Tooltip>
				</h2>
				<Controller
					name='locale'
					control={control}
					render={({ field, fieldState }) => (
						<Field
							orientation='responsive'
							className='!items-center'
							data-invalid={fieldState.invalid}
						>
							<FieldContent>
								<FieldLabel htmlFor='name'>Locale</FieldLabel>
								<FieldDescription>
									Adjust formatting of dates, times, and numbers to reflect your region.
								</FieldDescription>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</FieldContent>
							<Combobox
								{...field}
								disabled
								className='min-w-60'
								options={[{ label: 'Australia', value: 'en-AU' }]}
							/>
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
								<FieldLabel htmlFor='name'>Time zone</FieldLabel>
								<FieldDescription>
									Your time zone of record, which affects the time displayed in your invoices and
									summary data.
								</FieldDescription>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</FieldContent>
							<Combobox
								{...field}
								disabled
								className='min-w-60'
								options={[{ label: 'Sydney, Australia', value: 'Australia/Sydney' }]}
							/>
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
								<FieldLabel htmlFor='name'>
									Currency
									<Tooltip>
										<TooltipTrigger className='rounded-full'>
											<InfoIcon />
										</TooltipTrigger>
										<TooltipContent>
											If locale does not match, the currency code will be displayed on the invoice.
										</TooltipContent>
									</Tooltip>
								</FieldLabel>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</FieldContent>
							<Combobox
								{...field}
								disabled
								className='min-w-60'
								options={[{ label: 'AUD', value: 'AUD' }]}
							/>
						</Field>
					)}
				/>
			</FieldGroup>
			<div className='mt-18 flex gap-2 sm:justify-end'>
				<TextTooltip content='You have not made changes' disabled={isDirty}>
					<Button type='submit' className='max-sm:grow' variant='primary' disabled={!isDirty}>
						Save changes
					</Button>
				</TextTooltip>
			</div>
		</form>
	);
}
