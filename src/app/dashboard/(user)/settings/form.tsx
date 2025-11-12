'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createInsertSchema } from 'drizzle-zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { InfoTip } from '@/components/info';
import { config } from '@/db/schema/data';
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
	FieldLegend,
	FieldSet,
	FieldTitle,
} from '@/ui/field';
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group';
import { TextTooltip } from '@/ui/tooltip';
import { TaxRateField, taxArraySchema } from './taxRates';

const formSchema = createInsertSchema(config)
	.pick({
		taxRegistration: true,
		timezone: true,
		locale: true,
		currency: true,
		numberingScheme: true,
	})
	.extend({ taxes: taxArraySchema });

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
			numberingScheme: config.numberingScheme,
		},
	});

	return (
		<form
			className='grid gap-12'
			onSubmit={handleSubmit(
				async val => {
					// Prevent duplicate submissions
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
			<Controller
				name='numberingScheme'
				control={control}
				rules={{ required: true }}
				render={({ field, fieldState }) => {
					return (
						<FieldSet>
							<FieldLegend className='flex items-center gap-2'>
								Numbering scheme
								<InfoTip side='right'>
									Existing invoices will not be affected by changes to numbering scheme
								</InfoTip>
							</FieldLegend>
							<FieldDescription>Select the method used to identify your invoices.</FieldDescription>
							<RadioGroup
								{...field}
								onValueChange={field.onChange}
								className='flex max-sm:flex-col'
							>
								<FieldLabel>
									<Field orientation='vertical' className='h-full justify-between'>
										<div className='flex justify-between'>
											<FieldTitle>Sequential</FieldTitle>
											<RadioGroupItem value='sequential' />
										</div>
										<div className='flex items-end justify-between gap-6'>
											<FieldDescription className='text-balance'>
												Track invoices sequentially, over the life of the business
											</FieldDescription>
											<FieldDescription className='text-nowrap font-mono'>INV–001</FieldDescription>
										</div>
									</Field>
								</FieldLabel>
								<FieldLabel>
									<Field orientation='vertical' className='h-full justify-between'>
										<div className='flex justify-between'>
											<FieldTitle>Annual</FieldTitle>
											<RadioGroupItem value='annual' />
										</div>
										<div className='flex items-end justify-between gap-6'>
											<FieldDescription className='text-balance'>
												Reset invoice count with each new calendar year
											</FieldDescription>
											<FieldDescription className='text-nowrap font-mono'>
												{new Date().getFullYear()}–001
											</FieldDescription>
										</div>
									</Field>
								</FieldLabel>
							</RadioGroup>

							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
						</FieldSet>
					);
				}}
			/>
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
					<InfoTip side='right'>
						Existing invoices will not be affected by changes to localisation
					</InfoTip>
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
									<InfoTip side='right'>
										If locale does not match, the currency code will be displayed on the invoice
									</InfoTip>
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
