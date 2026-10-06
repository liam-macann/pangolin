'use client';

import { DotsThreeIcon } from '@phosphor-icons/react';
import { Controller, useFormContext } from 'react-hook-form';
import { Temporal } from 'temporal-polyfill';

import { formatDate } from '@/lib/utils/date';

import { Button } from '@/ui/button';
import { Calendar } from '@/ui/calendar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubContentTextarea,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { FieldError } from '@/ui/field';

import { type CreateInvoiceDraft } from './schema';

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
				<DropdownMenuItem disabled className='opacity-100!'>
					<div className='grid'>
						<span>Date of issue</span>
						<span className='text-muted-foreground text-xs'>
							{formatDate(Temporal.Now.plainDateISO(timezone), { locale })}
						</span>
					</div>
				</DropdownMenuItem>
				<DueDateSubmenu timezone={timezone} locale={locale} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function NotesSubmenu() {
	const { control } = useFormContext<CreateInvoiceDraft>();

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

function DueDateSubmenu({ timezone, locale }: { timezone: string; locale: string }) {
	const { control } = useFormContext<CreateInvoiceDraft>();
	const today = Temporal.Now.plainDateISO(timezone);

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
								{field.value ? formatDate(field.value, { locale }) : 'Not set'}
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
								startMonth={today}
								timeZone={timezone}
								{...field}
								disabled={field.disabled || [{ before: today }, today]}
								onSelect={v => field.onChange(v)}
							/>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>
			)}
		/>
	);
}
