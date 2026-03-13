'use client';

import { CheckIcon } from '@phosphor-icons/react';
import { type ComponentProps, useId, useState } from 'react';
import { type Control, Controller, type ControllerRenderProps } from 'react-hook-form';
import type z from 'zod/v4';
import { InfoTip } from '@/components/info';
import { cn } from '@/lib/utils';
import type { config as formSchema } from '@/lib/validation/config';
import schemes from '@/src/app/ui/colorSchemes';
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

type FormValues = z.input<typeof formSchema>;
type Fields = Pick<FormValues, 'colorScheme' | 'numberingScheme'>;

export function Customization<T extends Fields>({ control: _control }: { control: Control<T> }) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<Fields>;

	return (
		<FieldGroup>
			<Controller
				name='colorScheme'
				control={control}
				render={({ field, fieldState }) => (
					<Field orientation='responsive' data-invalid={fieldState.invalid}>
						<FieldContent>
							<FieldTitle id='colorSchemeLabel'>Color scheme</FieldTitle>
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
				render={({ field: { onChange, ...field }, fieldState }) => {
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
							<RadioGroup {...field} onValueChange={onChange} className='mt-1 flex max-sm:flex-col'>
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
	);
}

function ColorPalette({ onChange, ...field }: ControllerRenderProps<Fields, 'colorScheme'>) {
	const [hover, setHover] = useState<string | null>(null);
	return (
		<RadioGroup
			className='group/color-palette flex gap-2'
			{...field}
			aria-labelledby='colorSchemeLabel'
			onValueChange={onChange}
			onPointerLeave={() => setHover(null)}
		>
			{Object.entries(schemes).map(([key, scheme]) => (
				<ColorSwatch
					key={key}
					value={key}
					style={{ backgroundColor: scheme.accent }}
					selected={field.value === key}
					onMouseEnter={() => setHover(key)}
				/>
			))}
		</RadioGroup>
	);
}

function ColorSwatch({
	value,
	selected,
	...props
}: { value: string; selected: boolean } & ComponentProps<typeof RadioGroupItem>) {
	const id = useId();

	return (
		<div className='group flex flex-col'>
			<Button
				variant='primary'
				size='icon-sm'
				nativeButton={false}
				render={
					<RadioGroupItem
						className='peer !border-black/20 dark:!border-black/10 !rounded-full after:-inset-x-1.5 data-[state="checked"]:outline'
						value={value}
						aria-label={value}
						id={id}
						{...props}
					>
						<CheckIcon className='text-white' weight='bold' />
					</RadioGroupItem>
				}
			/>

			<FieldDescription
				className={cn(
					'hidden flex-col items-center text-xs capitalize group-hover:flex',
					selected && 'group-[:not(:hover)]/color-palette:flex',
				)}
				render={
					<label htmlFor={id}>
						<span className='absolute mt-1'>{value}</span>
					</label>
				}
			/>
		</div>
	);
}
