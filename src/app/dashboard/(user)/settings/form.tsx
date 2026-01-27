'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon } from '@phosphor-icons/react';
import { createInsertSchema } from 'drizzle-zod';
import { useState } from 'react';
import { Controller, type ControllerRenderProps, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { CurrencySelect } from '@/components/currency-select';
import { InfoTip } from '@/components/info';
import { RegionSelect } from '@/components/region-select';
import { TimezoneSelect } from '@/components/timezone-select';
import { config as configSchema } from '@/db/schema';
import { updateUserConfig } from '@/lib/actions/config';
import type { getUserConfig } from '@/lib/data';
import schemes from '@/src/app/ui/colorSchemes';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
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
import { PaymentDetailsField, paymentArraySchema } from './paymentDetails';
import { RegistrationNumberField, registrationArraySchema } from './registrationNumber';
import { DuplicateWarning, TaxRateField, taxArraySchema } from './taxRates';

const formSchema = createInsertSchema(configSchema)
	.pick({
		taxRegistration: true,
		timezone: true,
		region: true,
		currency: true,
		numberingScheme: true,
		colorScheme: true,
	})
	.extend({
		taxes: taxArraySchema,
		paymentDetails: paymentArraySchema,
		registrationNumber: registrationArraySchema,
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
		getFieldState,
	} = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			taxRegistration: config.taxRegistration,
			taxes: config.taxes.map(t => ({ ...t, rate: t.rate * 100 })),
			paymentDetails: config.paymentDetails || [],
			registrationNumber: config.registrationNumber || [],
			timezone: config.timezone,
			region: config.region,
			currency: config.currency,
			numberingScheme: config.numberingScheme,
			colorScheme: config.colorScheme,
		},
	});
	const [formVersion, setFormVersion] = useState(0); // Reset counter

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

					const promise = updateUserConfig(config, floatTaxes).then(() => {
						setFormVersion(v => v + 1);
						reset(val);
					});

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
				<Controller
					name='colorScheme'
					control={control}
					rules={{ required: true }}
					render={({ field, fieldState }) => (
						<Field
							orientation='responsive'
							className='!items-center'
							data-invalid={fieldState.invalid}
						>
							<FieldContent>
								<FieldLabel htmlFor='color-scheme'>Color scheme</FieldLabel>
								<FieldDescription>
									Select an accent color for your generated invoices
								</FieldDescription>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</FieldContent>

							<ColorPalette {...field} />
						</Field>
					)}
				/>

				<Controller
					name='numberingScheme'
					control={control}
					rules={{ required: true }}
					render={({ field, fieldState }) => {
						return (
							<FieldSet className='mt-4'>
								<FieldContent>
									<FieldLegend className='flex items-center gap-2'>
										Numbering scheme
										<InfoTip side='right'>
											Existing invoices will not be affected by changes to numbering scheme
										</InfoTip>
									</FieldLegend>
									<FieldDescription>
										Choose the method used to identify your invoices.
									</FieldDescription>
								</FieldContent>
								<RadioGroup
									{...field}
									onValueChange={field.onChange}
									className='mt-1 flex max-sm:flex-col'
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
												<FieldDescription className='text-nowrap font-mono text-xs tracking-wide'>
													INV–001
												</FieldDescription>
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
												<FieldDescription className='text-nowrap font-mono text-xs tracking-wide'>
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
			</FieldGroup>

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

				<FieldSet className='-mb-4 mt-4'>
					<FieldContent className='ml-8'>
						<FieldLegend className='flex items-center gap-2'>
							Tax rates
							<InfoTip side='right'>
								Taxes defined here will always be printed on invoices, even if no tax is applicable
							</InfoTip>
						</FieldLegend>
						<FieldDescription>
							When registered for tax, each rate can be applied on a per-item basis.
						</FieldDescription>
						<DuplicateWarning control={control} />
						{getFieldState('taxes').error?.root && (
							<FieldError errors={[getFieldState('taxes').error?.root]} />
						)}
					</FieldContent>

					<TaxRateField key={formVersion} control={control} className='-mt-1 min-h-32' />
				</FieldSet>
			</FieldGroup>

			<FieldGroup>
				<h2 className='flex items-baseline gap-3 font-bold text-2xl' id='details'>
					Your details
				</h2>

				<FieldSet>
					<FieldContent>
						<FieldLegend className='flex items-center gap-2'>Trading number</FieldLegend>
						<FieldDescription>
							Business or charity identifiers, as required for tax and legal compliance.
						</FieldDescription>
						{getFieldState('registrationNumber').error?.root && (
							<FieldError errors={[getFieldState('registrationNumber').error?.root]} />
						)}
					</FieldContent>
					<RegistrationNumberField
						key={formVersion}
						control={control}
						className='-mt-1 -mb-4 min-h-32'
					/>
				</FieldSet>

				<FieldSet>
					<FieldContent>
						<FieldLegend className='flex items-center gap-2'>Payment information</FieldLegend>
						<FieldDescription>
							Bank account numbers will be printed on the invoice footer. Please ensure details are
							accurate.
						</FieldDescription>
						{getFieldState('paymentDetails').error?.root && (
							<FieldError errors={[getFieldState('paymentDetails').error?.root]} />
						)}
					</FieldContent>
					<PaymentDetailsField
						key={formVersion}
						control={control}
						className='-mt-1 -mb-4 min-h-32'
					/>
				</FieldSet>
			</FieldGroup>

			<FieldGroup className='mb-14'>
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
							<TimezoneSelect
								id='timezone'
								locale={config.locale}
								{...field}
								onValueChange={field.onChange}
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
								<FieldLabel htmlFor='currency'>Currency</FieldLabel>
								<FieldDescription>
									The currency will be displayed on invoices if different from locale.
								</FieldDescription>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</FieldContent>
							<CurrencySelect {...field} onValueChange={field.onChange} />
						</Field>
					)}
				/>
			</FieldGroup>
			<div className='-mx-2 sticky bottom-0 flex grid-cols-2 gap-2 border-t bg-background px-2 py-4 pb-6 max-sm:grid max-md:fixed max-md:right-0 max-md:left-0 max-md:px-8 sm:justify-end'>
				<Button
					type='button'
					variant='ghost'
					onClick={() => {
						setFormVersion(v => v + 1);
						reset();
					}}
					disabled={!isDirty || isSubmitting}
				>
					Cancel
				</Button>
				<TextTooltip asChild content='You have not made changes' disabled={isDirty}>
					<Button type='submit' variant='primary' disabled={!isDirty || isSubmitting}>
						Save changes
					</Button>
				</TextTooltip>
			</div>
		</form>
	);
}

function ColorPalette({
	...field
}: ControllerRenderProps<z.infer<typeof formSchema>, 'colorScheme'>) {
	const [hover, setHover] = useState<string | null>(null);
	return (
		<div className='flex flex-col @md/field-group:items-end gap-2'>
			<RadioGroup
				className='flex'
				{...field}
				value={field.value}
				onValueChange={field.onChange}
				onPointerLeave={() => setHover(null)}
			>
				{Object.entries(schemes).map(([key, scheme]) => (
					<div key={key} className='flex flex-col'>
						<Button
							variant='primary'
							size='icon-sm'
							render={
								<RadioGroupItem
									className='peer !border-black/20 !rounded-full text-white outline-gray-11 data-[state="checked"]:outline'
									style={{ backgroundColor: scheme.accent }}
									value={key}
									onMouseEnter={() => setHover(key)}
								>
									<CheckIcon
										className='fade-in-0 zoom-in-90 animate-in duration-150'
										weight='bold'
									/>
								</RadioGroupItem>
							}
						/>
						{key === (hover || field.value) && (
							<FieldDescription className='text-center text-xs capitalize'>
								<span className='-translate-x-1/2 absolute mt-2'>{key}</span>
							</FieldDescription>
						)}
					</div>
				))}
			</RadioGroup>
		</div>
	);
}
