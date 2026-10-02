'use client';

import { CaretUpDownIcon } from '@phosphor-icons/react/ssr';
import * as React from 'react';
import {
	type DateRange as DateRangeType,
	type PropsBase,
	type PropsMulti,
	type PropsMultiRequired,
	type PropsRange,
	type PropsRangeRequired,
	type PropsSingle,
	type PropsSingleRequired,
} from 'react-day-picker';

import { cn, type DistributedOmit, pluralize } from '@/lib/utils';
import { formatDate } from '@/lib/utils/date';

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

type Expose<Type> = Type extends unknown ? Omit<Type, 'mode' | 'disabled' | 'selected'> : never;

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
			<PopoverTrigger
				render={
					<Button
						variant='outline'
						aria-expanded={open}
						className={cn('min-w-[200px] scale-100! justify-between', className)}
					>
						<span className='truncate'>{label || 'Select date…'}</span>
						<CaretUpDownIcon className='ml-2 h-4 w-4 shrink-0 opacity-50' />
					</Button>
				}
				{...props}
			/>
			<PopoverContent className='w-auto p-2' align='start'>
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

	locale,
	timeZone,

	disabledDays,
	...props
}: DistributedOmit<SinglePickerProps, 'locale'> &
	RHF<Date> & {
		timeZone: string;
		locale: string;
	}) {
	const [open, setOpen] = React.useState(false);
	const [date, setDate] = React.useState<Date>();
	props;
	const value = controlledValue || date;

	return (
		<CalendarPopover
			open={open}
			onOpenChange={setOpen}
			label={value && formatDate(value.toISOString(), timeZone, { locale })}
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
				timeZone={timeZone}
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
}: MultiPickerProps & RHF<Date[]> & { timeZone: string }) {
	const [dates, setDates] = React.useState<Date[]>();

	const value = controlledValue || dates;

	return (
		<CalendarPopover
			label={
				value && value.length > 0
					? `${value.length} ${pluralize(value.length, 'date', 'dates')} selected`
					: 'Select dates…'
			}
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

	locale,
	timeZone,

	disabledDays,
	...props
}: DistributedOmit<RangePickerProps, 'locale'> &
	RHF<DateRangeType> & {
		timeZone: string;
		locale: string;
	}) {
	const [date, setDate] = React.useState<DateRangeType>();

	const value = controlledValue || date;

	return (
		<CalendarPopover
			label={
				(value?.from &&
					value?.to &&
					`${formatDate(value.from.toISOString(), timeZone, { locale })} – ${formatDate(value.to.toISOString(), timeZone, { locale })}`) ||
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
				timeZone={timeZone}
				{...props}
			/>
		</CalendarPopover>
	);
}
