'use client';

import { useId } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Temporal } from 'temporal-polyfill';

import { formatDate } from '@/lib/utils/date';

import { ChatTextIcon, ClockIcon } from '@/icons';

import { Button } from '@/ui/button';
import { ButtonGroup } from '@/ui/button-group';
import { Calendar } from '@/ui/calendar';
import { FieldError } from '@/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Textarea } from '@/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

import { type CreateInvoiceDraft } from './schema';

export function InvoiceOptions({ timezone, locale }: { timezone: string; locale: string }) {
	return (
		<ButtonGroup className='mr-auto'>
			<DueDateButton timezone={timezone} locale={locale} />
			<NotesButton />
		</ButtonGroup>
	);
}

/** An icon button that opens a popover. */
function OptionButton({
	label,
	tooltip,
	icon,
	invalid,
	children,
	className,
}: {
	label: string;
	tooltip: React.ReactNode;
	icon: React.ReactNode;
	invalid?: boolean;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Button
									variant='outline'
									size='icon-sm'
									aria-invalid={invalid || undefined}
									className='aria-invalid:text-destructive'
								>
									{icon}
									<span className='sr-only'>{label}</span>
								</Button>
							}
						/>
					}
				/>
				<TooltipContent>{tooltip}</TooltipContent>
			</Tooltip>

			<PopoverContent side='top' align='start' className={className}>
				{children}
			</PopoverContent>
		</Popover>
	);
}

function DueDateButton({ timezone, locale }: { timezone: string; locale: string }) {
	const { control } = useFormContext<CreateInvoiceDraft>();
	const today = Temporal.Now.plainDateISO(timezone);

	return (
		<Controller
			name='dueAt'
			control={control}
			render={({ field, fieldState }) => (
				<OptionButton
					label='Due date'
					icon={<ClockIcon aria-hidden />}
					invalid={fieldState.invalid}
					tooltip={
						field.value
							? `Due ${formatDate(field.value, { locale, omitCurrentYearIn: timezone })}`
							: `Set due date`
					}
					className='w-auto gap-2 p-2'
				>
					<Calendar
						autoFocus
						id='dueAt'
						className='min-w-0'
						mode='single'
						selected={field.value}
						defaultMonth={field.value}
						startMonth={today}
						timeZone={timezone}
						{...field}
						disabled={field.disabled || [{ before: today }, today]}
						onSelect={v => field.onChange(v)}
					/>

					{fieldState.invalid && (
						<FieldError className='mx-1 text-xs' errors={[fieldState.error]} />
					)}
				</OptionButton>
			)}
		/>
	);
}

function NotesButton() {
	const { control } = useFormContext<CreateInvoiceDraft>();
	const id = useId();

	return (
		<Controller
			name='notes'
			control={control}
			render={({ field, fieldState }) => (
				<OptionButton
					label='Notes'
					icon={<ChatTextIcon aria-hidden />}
					invalid={fieldState.invalid}
					tooltip={field.value ? 'Edit notes' : 'Add notes'}
					className='w-48 p-1'
				>
					<label htmlFor={id} className='sr-only'>
						Your private notes
					</label>
					<Textarea
						{...field}
						value={field.value ?? ''}
						id={id}
						autoFocus
						placeholder='Your private notes'
						className='inset-shadow-xs rounded-sm border-border! shadow-none ring-0! dark:bg-card'
					/>

					{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
				</OptionButton>
			)}
		/>
	);
}
