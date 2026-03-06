'use client';

import { CaretDownIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import * as React from 'react';
import { type DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/ui/button';

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	captionLayout = 'label',
	buttonVariant = 'ghost',
	formatters,
	components,
	...props
}: React.ComponentProps<typeof DayPicker> & {
	buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn(
				'group/calendar bg-background p-3 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent',
				String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
				String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
				className,
			)}
			captionLayout={captionLayout}
			formatters={{
				formatMonthDropdown: date => date.toLocaleString('default', { month: 'short' }),
				...formatters,
			}}
			classNames={{
				root: cn('w-fit', defaultClassNames.root),
				months: cn('relative flex flex-col gap-4 md:flex-row', defaultClassNames.months),
				month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
				nav: cn(
					'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
					defaultClassNames.nav,
				),
				button_previous: cn(
					buttonVariants({ variant: buttonVariant }),
					'size-(--cell-size) select-none p-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-inherit',
					defaultClassNames.button_previous,
				),
				button_next: cn(
					buttonVariants({ variant: buttonVariant }),
					'size-(--cell-size) select-none p-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-inherit',
					defaultClassNames.button_next,
				),
				month_caption: cn(
					'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
					defaultClassNames.month_caption,
				),
				dropdowns: cn(
					'flex h-(--cell-size) w-full items-center justify-center gap-1.5 font-medium text-sm',
					defaultClassNames.dropdowns,
				),
				dropdown_root: cn(
					'relative rounded-md border border-input shadow-xs has-focus:border-ring has-focus:ring-2',
					defaultClassNames.dropdown_root,
				),
				dropdown: cn('absolute inset-0 bg-popover opacity-0', defaultClassNames.dropdown),
				caption_label: cn(
					'select-none font-medium',
					captionLayout === 'label'
						? 'text-sm'
						: 'flex h-8 items-center gap-1 rounded-md pr-1 pl-2 text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground',
					defaultClassNames.caption_label,
				),
				table: 'w-full border-collapse',
				weekdays: cn('mb-2 flex', defaultClassNames.weekdays),
				weekday: cn(
					'flex-1 select-none font-normal text-[0.8rem] text-muted-foreground',
					defaultClassNames.weekday,
				),
				week: cn('flex w-full', defaultClassNames.week),
				week_number_header: cn('w-(--cell-size) select-none', defaultClassNames.week_number_header),
				week_number: cn(
					'select-none text-[0.8rem] text-muted-foreground',
					defaultClassNames.week_number,
				),
				day: cn(
					'group/day relative aspect-square h-full w-full select-none p-0 text-center',
					defaultClassNames.day,
				),
				range_start: cn('rounded-l-full', defaultClassNames.range_start),
				range_middle: cn(
					'*:before:!rounded-none text-accent-foreground *:before:inset-x-0 *:before:bg-accent',
					defaultClassNames.range_middle,
				),
				range_end: cn('rounded-r-full', defaultClassNames.range_end),
				today: cn(
					'*:after:-bottom-0.5 *:after:absolute *:after:content-["•"]',
					defaultClassNames.today,
				),
				outside: cn('not-aria-selected:*:text-muted-foreground', defaultClassNames.outside),
				disabled: cn('text-muted-foreground opacity-50', defaultClassNames.disabled),
				hidden: cn('invisible', defaultClassNames.hidden),
				...classNames,
			}}
			components={{
				Root: ({ className, rootRef, ...props }) => {
					return <div data-slot='calendar' ref={rootRef} className={cn(className)} {...props} />;
				},
				Chevron: ({ className, orientation, ...props }) => {
					if (orientation === 'left') {
						return <CaretLeftIcon className={cn('size-4', className)} {...props} />;
					}

					if (orientation === 'right') {
						return <CaretRightIcon className={cn('size-4', className)} {...props} />;
					}

					return <CaretDownIcon className={cn('size-4', className)} {...props} />;
				},
				DayButton: CalendarDayButton,
				WeekNumber: ({ children, ...props }) => {
					return (
						<td {...props}>
							<div className='flex size-(--cell-size) items-center justify-center text-center'>
								{children}
							</div>
						</td>
					);
				},
				...components,
			}}
			{...props}
		/>
	);
}

function CalendarDayButton({
	className,
	day,
	modifiers,
	...props
}: React.ComponentProps<typeof DayButton>) {
	const defaultClassNames = getDefaultClassNames();

	const ref = React.useRef<HTMLButtonElement>(null);
	React.useEffect(() => {
		if (modifiers.focused) ref.current?.focus();
	}, [modifiers.focused]);

	return (
		<Button
			ref={ref}
			variant='ghost'
			size='icon-sm'
			data-day={day.date.toLocaleDateString()}
			data-selected-single={
				modifiers.selected &&
				!modifiers.range_start &&
				!modifiers.range_end &&
				!modifiers.range_middle
			}
			data-range-start={modifiers.range_start}
			data-range-end={modifiers.range_end}
			data-range-middle={modifiers.range_middle}
			className={cn(
				'!bg-transparent rounded-none font-normal transition-none', // Button reset
				'flex aspect-square min-w-(--cell-size) flex-col gap-1 leading-none', // Sizing
				'before:-z-10 isolate before:absolute before:inset-0.5 before:rounded-full not-disabled:hover:before:bg-accent', // Hover and selection background
				'!ring-0 !border-transparent group-data-[focused=true]/day:before:border-ring group-data-[focused=true]/day:before:ring-2', // Focus ring

				'data-[range-end=true]:before:!bg-primary data-[range-start=true]:before:!bg-primary data-[selected-single=true]:before:!bg-primary',
				'data-[range-end=true]:before:ring-offset-1 data-[range-start=true]:before:ring-offset-1 data-[selected-single=true]:before:ring-offset-1',
				'data-[range-end=true]:!text-primary-foreground data-[range-start=true]:!text-primary-foreground data-[selected-single=true]:!text-primary-foreground',

				defaultClassNames.day,
				className,
			)}
			{...props}
		/>
	);
}

export { Calendar, CalendarDayButton };
