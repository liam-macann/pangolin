'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { InfoIcon } from '@phosphor-icons/react/ssr';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { updateUserConfig } from '@/lib/actions';
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
import { TaxRateField, taxArraySchema } from './taxRates';

const formSchema = z.object({
	taxes: taxArraySchema,
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
	const {
		formState: { isDirty, isSubmitting },
		handleSubmit,
		control,
		reset,
	} = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			taxRegistration: config.taxRegistration,
			taxes: config.tax.map(t => ({ ...t, rate: t.rate * 100 })),
			timezone: config.timezone,
			locale: config.locale,
			currency: config.currency,
		},
	});

	return (
		<form
			className='grid gap-12'
			onSubmit={handleSubmit(
				async val => {
					if (isSubmitting) return;
					else if (!isDirty) {
						toast.info('You have not made any changes');
						return;
					}

					const { taxes, ...config } = val;

					const floatTaxes = taxes.map(tax => ({
						...tax,
						// Convert the whole number percentage back to a decimal
						rate: Number(tax.rate) / 100,
					}));

					const promise = updateUserConfig(config, floatTaxes).then(() => reset(val));

					toast.promise(promise, {
						loading: 'Updating settings…',
						success: 'Settings updated successfully',
						error: 'Failed to update configuration',
					});

					return promise;
				},
				() => toast.warning('Please ensure all fields are filled correctly'),
			)}
		>
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

				<TaxRateField control={control} className='mt-4' />
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
									<TextTooltip
										className='rounded-full'
										content='If locale does not match, the currency code will be displayed on the invoice.'
									>
										<InfoIcon />
									</TextTooltip>
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
				<TextTooltip asChild content='You have not made changes' disabled={isDirty}>
					<Button
						type='submit'
						className='max-sm:grow'
						variant='primary'
						disabled={!isDirty || isSubmitting}
					>
						Save changes
					</Button>
				</TextTooltip>
			</div>
		</form>
	);
}
