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
	FieldTitle,
} from '@/ui/field';
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group';

import { ColorPalette } from '@/src/app/(dashboard)/(user)/settings/sections/customization';
import { customization, useOnboardingStore } from '@/src/app/onboarding/state';

import { Footer } from './../ui';

export function Customization() {
	const config = useOnboardingStore(state => state.config);

	const setFields = useOnboardingStore(state => state.setFields);
	const next = useOnboardingStore(state => state.next);

	const { control, handleSubmit } = useForm({
		resolver: zodResolver(customization),
		defaultValues: {
			colorScheme: config.colorScheme ?? 'blue',
			numberingScheme: config.numberingScheme ?? 'sequential',
		},
	});

	return (
		<form
			onSubmit={handleSubmit(data => {
				setFields(data);
				next();
			})}
		>
			<h1 className='mb-6 font-bold text-xl'>Customisation</h1>

			<FieldGroup>
				<Controller
					name='colorScheme'
					control={control}
					render={({ field, fieldState }) => (
						<Field orientation='responsive' data-invalid={fieldState.invalid}>
							<FieldContent>
								<FieldTitle id='colorSchemeLabel'>Color scheme</FieldTitle>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</FieldContent>

							<ColorPalette {...field} />
						</Field>
					)}
				/>

				<Controller
					name='numberingScheme'
					control={control}
					render={({ field: { onChange, ...field }, fieldState }) => {
						return (
							<FieldSet className='mt-4'>
								<FieldContent>
									<FieldLegend variant='label'>Numbering scheme</FieldLegend>
									<FieldDescription>
										Choose the method used to identify your invoices.
									</FieldDescription>
								</FieldContent>

								<RadioGroup
									{...field}
									data-invalid={fieldState.invalid}
									onValueChange={onChange}
									className='mt-1'
								>
									<FieldLabel>
										<Field orientation='vertical' className='h-full justify-between'>
											<div className='flex justify-between'>
												<FieldTitle>Sequential</FieldTitle>
												<RadioGroupItem aria-invalid={fieldState.invalid} value='sequential' />
											</div>
											<div className='flex items-end justify-between gap-3'>
												<FieldDescription className='text-balance'>
													Track invoices over the entire business
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
												<RadioGroupItem aria-invalid={fieldState.invalid} value='annual' />
											</div>
											<div className='flex items-end justify-between gap-3'>
												<FieldDescription className='text-balance'>
													Reset count with each calendar year
												</FieldDescription>
												<FieldDescription className='text-nowrap font-mono text-xs tracking-wide'>
													{new Date().getFullYear()}–001
												</FieldDescription>
											</div>
										</Field>
									</FieldLabel>
								</RadioGroup>

								<FieldError errors={[fieldState.error]} />
							</FieldSet>
						);
					}}
				/>
			</FieldGroup>

			<Footer
				next={
					<Button variant='primary' type='submit'>
						Submit
					</Button>
				}
			/>
		</form>
	);
}
