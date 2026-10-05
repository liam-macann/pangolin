'use client';

import { TZDate } from '@date-fns/tz';
import { DotsThreeIcon } from '@phosphor-icons/react';
import { Controller, useFormContext } from 'react-hook-form';

import { formatDate } from '@/lib/utils/date';

import { Button } from '@/ui/button';
import { Calendar } from '@/ui/calendar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubContentTextarea,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { FieldError } from '@/ui/field';

import { type CreateInvoiceFormValues } from './types';

export function InvoiceOptions({ timezone, locale }: { timezone: string; locale: string }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant='ghost' size='icon' className='mr-auto'>
						<DotsThreeIcon weight='bold' />
						<span className='sr-only'>Options</span>
					</Button>
				}
			/>

			<DropdownMenuContent side='left' align='end' className='w-auto'>
				<NotesSubmenu />
				<DropdownMenuSeparator />
				<IssueDateSubmenu timezone={timezone} locale={locale} />
				<DueDateSubmenu timezone={timezone} locale={locale} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function NotesSubmenu() {
	const { control } = useFormContext<CreateInvoiceFormValues>();

	return (
		<Controller
			name='notes'
			control={control}
			render={({ field, fieldState }) => (
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<div className='grid'>
							<span>Notes</span>
							{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
						</div>
					</DropdownMenuSubTrigger>

					<DropdownMenuSubContent>
						<DropdownMenuSubContentTextarea {...field} label='Your private notes' />
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			)}
		/>
	);
}

function IssueDateSubmenu({ timezone, locale }: { timezone: string; locale: string }) {
	const { control } = useFormContext<CreateInvoiceFormValues>();

	return (
		<Controller
			name='issuedAt'
			control={control}
			render={({ field, fieldState }) => (
				<DropdownMenuSub disabled>
					<DropdownMenuSubTrigger disabled>
						<div className='grid'>
							<span>Date of issue</span>
							{field.value && (
								<span className='text-muted-foreground text-xs'>
									{formatDate(new TZDate(field.value, timezone), { locale })}
								</span>
							)}
							{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
						</div>
					</DropdownMenuSubTrigger>
					<DropdownMenuPortal>
						<DropdownMenuSubContent>
							<Calendar
								id='issuedAt'
								className='min-w-0 p-1'
								mode='single'
								selected={field.value}
								defaultMonth={field.value}
								timeZone={timezone}
								{...field}
								onSelect={v => field.onChange(v)}
								disabled
							/>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>
			)}
		/>
	);
}

function DueDateSubmenu({ timezone, locale }: { timezone: string; locale: string }) {
	const { control } = useFormContext<CreateInvoiceFormValues>();

	return (
		<Controller
			name='dueAt'
			control={control}
			render={({ field, fieldState }) => (
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<div className='grid'>
							<span>Due date</span>
							<span className='text-muted-foreground text-xs'>
								{field.value
									? formatDate(new TZDate(field.value, timezone), { locale })
									: 'Not set'}
							</span>
							{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
						</div>
					</DropdownMenuSubTrigger>
					<DropdownMenuPortal>
						<DropdownMenuSubContent>
							<Calendar
								autoFocus
								id='dueAt'
								className='min-w-0 p-1'
								mode='single'
								selected={field.value}
								defaultMonth={field.value}
								disabled={[{ before: TZDate.tz(timezone) }, TZDate.tz(timezone)]}
								startMonth={TZDate.tz(timezone)}
								timeZone={timezone}
								{...field}
								onSelect={v => field.onChange(v)}
							/>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>
			)}
		/>
	);
}
