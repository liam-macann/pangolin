'use client';

import { Select as SelectPrimitive } from '@base-ui/react/select';
import { CaretDownIcon, CaretUpIcon, CheckIcon } from '@phosphor-icons/react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';
import { DropdownMenuSeparator } from './dropdown-menu';

const Select = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
	return (
		<SelectPrimitive.Group
			data-slot='select-group'
			className={cn('scroll-my-1 p-1', className)}
			{...props}
		/>
	);
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
	return (
		<SelectPrimitive.Value
			data-slot='select-value'
			className={cn('flex flex-1 text-left', className)}
			{...props}
		/>
	);
}

function SelectTrigger({
	className,
	size,
	children,
	...props
}: SelectPrimitive.Trigger.Props & Pick<React.ComponentProps<typeof Button>, 'size'>) {
	return (
		<SelectPrimitive.Trigger
			data-slot='select-trigger'
			className={cn(
				'data-placeholder:text-muted-foreground',
				'*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2',
				'aria-invalid:border-destructive aria-invalid:ring aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
				'not-disabled:active:motion-safe:scale-100',
				className,
			)}
			render={<Button size={size} className={cn('bg-none font-normal')} />}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon
				render={
					<CaretDownIcon className='pointer-events-none -mr-0.5 size-4 text-inherit opacity-50' />
				}
			/>
		</SelectPrimitive.Trigger>
	);
}

function SelectContent({
	className,
	children,
	side = 'bottom',
	sideOffset = 4,
	align = 'center',
	alignOffset = 0,
	alignItemWithTrigger = true,
	...props
}: SelectPrimitive.Popup.Props &
	Pick<
		SelectPrimitive.Positioner.Props,
		'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
	>) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				alignItemWithTrigger={alignItemWithTrigger}
				className='isolate z-50'
			>
				<SelectPrimitive.Popup
					data-slot='select-content'
					data-align-trigger={alignItemWithTrigger}
					className={cn(
						'group/select-popup relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 data-closed:overflow-hidden',
						'data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
						'fade-in-0 zoom-in-95 fade-out-0 zoom-out-95 blur-in-[2px] blur-out-[2px] duration-150 ease-out-quint data-closed:animate-out data-open:animate-in',
						className,
					)}
					{...props}
				>
					<SelectScrollUpButton />
					<SelectPrimitive.List>{children}</SelectPrimitive.List>
					<SelectScrollDownButton />
				</SelectPrimitive.Popup>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	);
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
	return (
		<SelectPrimitive.GroupLabel
			data-slot='select-label'
			className={cn('px-2 py-1.5 text-muted-foreground text-xs', className)}
			{...props}
		/>
	);
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
	return (
		<SelectPrimitive.Item
			data-slot='select-item'
			className={cn(
				"relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
				// Helps to diguise jitter with item-aligned select during scale-in animation
				'fade-in-50 fade-out-50 duration-100 group-data-closed/select-popup:animate-out group-data-open/select-popup:animate-in group-data-closed/select-popup:ease-out-circ group-data-open/select-popup:ease-in',
				className,
			)}
			{...props}
		>
			<SelectPrimitive.ItemText className='flex flex-1 shrink-0 gap-2 whitespace-nowrap'>
				{children}
			</SelectPrimitive.ItemText>
			<SelectPrimitive.ItemIndicator
				render={
					<span className='pointer-events-none absolute right-2 flex size-4 items-center justify-center' />
				}
			>
				<CheckIcon className='pointer-events-none' />
			</SelectPrimitive.ItemIndicator>
		</SelectPrimitive.Item>
	);
}

function SelectClear({ className, children, ...props }: Omit<SelectPrimitive.Item.Props, 'value'>) {
	return (
		<SelectItem key={'reset'} value={null} {...props}>
			{children ?? '–'}
		</SelectItem>
	);
}

function SelectSeparator({ ...props }: SelectPrimitive.Separator.Props) {
	return (
		<SelectPrimitive.Separator
			render={DropdownMenuSeparator}
			data-slot='select-separator'
			{...props}
		/>
	);
}

function SelectScrollUpButton({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
	return (
		<SelectPrimitive.ScrollUpArrow
			data-slot='select-scroll-up-button'
			className={cn(
				"top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			<CaretUpIcon />
		</SelectPrimitive.ScrollUpArrow>
	);
}

function SelectScrollDownButton({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
	return (
		<SelectPrimitive.ScrollDownArrow
			data-slot='select-scroll-down-button'
			className={cn(
				"bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			<CaretDownIcon />
		</SelectPrimitive.ScrollDownArrow>
	);
}

export {
	Select,
	SelectClear,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
};
