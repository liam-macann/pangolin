'use client';

import { CaretUpDownIcon } from '@phosphor-icons/react/ssr';
import { format } from 'date-fns';
import * as React from 'react';
import type {
	DateRange as DateRangeType,
	PropsBase,
	PropsMulti,
	PropsMultiRequired,
	PropsRange,
	PropsRangeRequired,
	PropsSingle,
	PropsSingleRequired,
} from 'react-day-picker';
import { cn, formatDateToLocal } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Calendar } from '@/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';

/** Omits deprecated props */
type MinimalPropsBase = Omit<
	Expose<PropsBase>,
	| 'fromDate'
	| 'fromMonth'
	| 'fromYear'
	| 'toDate'
	| 'toMonth'
	| 'toYear'
	| 'initialFocus'
	| 'onWeekNumberClick'
	| 'onDayKeyUp'
	| 'onDayKeyPress'
	| 'onDayPointerEnter'
	| 'onDayPointerLeave'
	| 'onDayTouchCancel'
	| 'onDayTouchEnd'
	| 'onDayTouchMove'
	| 'onDayTouchStart'
> & { disabledDays?: PropsBase['disabled'] };

type Expose<Type> = Type extends any ? Omit<Type, 'mode' | 'disabled'> : never;

type SinglePickerProps = MinimalPropsBase & Expose<PropsSingle | PropsSingleRequired>;
type MultiPickerProps = MinimalPropsBase & Expose<PropsMulti | PropsMultiRequired>;
type RangePickerProps = MinimalPropsBase & Expose<PropsRange | PropsRangeRequired>;

function CalendarPopover({
	className,
	children,
	label,
	open,
	onOpenChange,
	...props
}: {
	className?: string;
	children: React.ReactNode;
	label: string | undefined;
	open?: React.ComponentProps<typeof Popover>['open'];
	onOpenChange?: React.ComponentProps<typeof Popover>['onOpenChange'];
} & React.ComponentProps<typeof Button>) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant='outline'
					aria-expanded={open}
					className={cn('min-w-[200px] justify-between enabled:active:scale-100', className)}
					{...props}
				>
					<span className='truncate'>{label || 'Select date…'}</span>
					<CaretUpDownIcon className='ml-2 h-4 w-4 shrink-0 opacity-50' />
				</Button>
			</PopoverTrigger>
			<PopoverContent className='w-auto p-0' align='start'>
				{children}
			</PopoverContent>
		</Popover>
	);
}

interface RHF<T> {
	onChange?: (value: T | undefined) => void;
	onBlur?: () => void;
	value?: T;
	disabled?: boolean;
	ref?: React.Ref<HTMLButtonElement>;
}

export function DatePicker({
	onChange,
	onBlur,
	value: controlledValue,
	disabled = false,
	ref,
	className,

	disabledDays,
	...props
}: SinglePickerProps & RHF<Date>) {
	const [open, setOpen] = React.useState(false);
	const [date, setDate] = React.useState<Date>();

	const value = controlledValue || date;

	return (
		<CalendarPopover
			open={open}
			onOpenChange={setOpen}
			label={value && formatDateToLocal(value)}
			disabled={disabled}
			onBlur={onBlur}
			ref={ref}
			className={className}
		>
			<Calendar
				mode='single'
				selected={value}
				defaultMonth={value}
				onSelect={v => {
					setDate(v);
					onChange?.(v);
					setOpen(false);
				}}
				disabled={disabledDays}
				{...props}
			/>
		</CalendarPopover>
	);
}

export function DatePickerMultiple({
	onChange,
	onBlur,
	value: controlledValue,
	disabled = false,
	ref,

	disabledDays,
	...props
}: MultiPickerProps & RHF<Date[]>) {
	const [dates, setDates] = React.useState<Date[]>();

	const value = controlledValue || dates;

	return (
		<CalendarPopover
			label={value && value.length > 0 ? `${value.length} dates selected` : 'Select dates…'}
			disabled={disabled}
			onBlur={onBlur}
			ref={ref}
		>
			<Calendar
				mode='multiple'
				selected={value}
				defaultMonth={value?.[0]}
				onSelect={v => {
					setDates(v);
					onChange?.(v);
				}}
				disabled={disabledDays}
				{...props}
			/>
		</CalendarPopover>
	);
}

export function DateRange({
	onChange,
	onBlur,
	value: controlledValue,
	disabled = false,
	ref,

	disabledDays,
	...props
}: RangePickerProps & RHF<DateRangeType>) {
	const [date, setDate] = React.useState<DateRangeType>();

	const value = controlledValue || date;

	return (
		<CalendarPopover
			label={
				(value?.from &&
					value?.to &&
					`${formatDateToLocal(value.from)} – ${formatDateToLocal(value.to)}`) ||
				'Select dates…'
			}
			disabled={disabled}
			onBlur={onBlur}
			ref={ref}
		>
			<Calendar
				mode='range'
				selected={value}
				defaultMonth={value?.from}
				onSelect={v => {
					setDate(v);
					onChange?.(v);
				}}
				disabled={disabledDays}
				{...props}
			/>
		</CalendarPopover>
	);
}
