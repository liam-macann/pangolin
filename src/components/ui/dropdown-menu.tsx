'use client';

import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { CaretRightIcon, CheckIcon } from '@phosphor-icons/react';
import type * as React from 'react';
import { useId } from 'react';

import { cn } from '@/lib/utils';

import { Checkbox } from './checkbox';
import { Textarea } from './textarea';

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
	return <MenuPrimitive.Root data-slot='dropdown-menu' {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
	return <MenuPrimitive.Portal data-slot='dropdown-menu-portal' {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
	return <MenuPrimitive.Trigger data-slot='dropdown-menu-trigger' {...props} />;
}

function DropdownMenuContent({
	align = 'start',
	alignOffset = 0,
	side = 'bottom',
	sideOffset = 4,
	className,
	keepMounted,
	...props
}: MenuPrimitive.Popup.Props &
	Pick<MenuPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'> &
	Pick<MenuPrimitive.Portal.Props, 'keepMounted'>) {
	return (
		<MenuPrimitive.Portal keepMounted={keepMounted}>
			<MenuPrimitive.Positioner
				className='isolate z-50 outline-none'
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
			>
				<MenuPrimitive.Popup
					data-slot='dropdown-menu-content'
					className={cn(
						'z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-md bg-popover p-1 text-popover-foreground shadow-md outline-none ring-1 ring-foreground/10 data-closed:overflow-hidden',
						'duration-150 ease-out-quint data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:data-[ending-style]:scale-95 motion-safe:data-[starting-style]:scale-95 motion-safe:data-[ending-style]:blur-[2px] motion-safe:data-[starting-style]:blur-[2px]',
						className,
					)}
					{...props}
				/>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
	return <MenuPrimitive.Group data-slot='dropdown-menu-group' {...props} />;
}

function DropdownMenuLabel({
	className,
	inset,
	...props
}: MenuPrimitive.GroupLabel.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.GroupLabel
			data-slot='dropdown-menu-label'
			data-inset={inset}
			className={cn('px-2 py-1.5 font-medium text-sm data-inset:pl-8', className)}
			{...props}
		/>
	);
}

function DropdownMenuItem({
	className,
	inset,
	variant = 'default',
	...props
}: MenuPrimitive.Item.Props & {
	inset?: boolean;
	variant?: 'default' | 'destructive';
}) {
	return (
		<MenuPrimitive.Item
			data-slot='dropdown-menu-item'
			data-inset={inset}
			data-variant={variant}
			className={cn(
				"group/dropdown-menu-item relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-[variant=destructive]:text-destructive data-disabled:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[variant=destructive]:*:[svg]:text-destructive",
				className,
			)}
			{...props}
		/>
	);
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
	return <MenuPrimitive.SubmenuRoot data-slot='dropdown-menu-sub' {...props} />;
}

function DropdownMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: MenuPrimitive.SubmenuTrigger.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.SubmenuTrigger
			data-slot='dropdown-menu-sub-trigger'
			data-inset={inset}
			className={cn(
				"group/dropdown-menu-sub-trigger flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-open:bg-accent data-popup-open:bg-accent data-inset:pl-8 data-open:text-accent-foreground data-popup-open:text-accent-foreground data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			{children}
			<CaretRightIcon className='ml-auto group-data-disabled/dropdown-menu-sub-trigger:invisible' />
		</MenuPrimitive.SubmenuTrigger>
	);
}

function DropdownMenuSubContent({
	align = 'start',
	alignOffset = -3,
	side = 'right',
	sideOffset = 0,
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
	return (
		<DropdownMenuContent
			data-slot='dropdown-menu-sub-content'
			className={cn(
				'w-auto min-w-[96px] rounded-md bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100',
				className,
			)}
			align={align}
			alignOffset={alignOffset}
			side={side}
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

export function DropdownMenuSubContentTextarea({
	className,
	label,
	id,
	onKeyDown,
	...props
}: React.ComponentProps<typeof Textarea> & { label: string }) {
	const internalId = useId();
	return (
		<>
			<label htmlFor={id || internalId} className='sr-only'>
				{label}
			</label>
			<Textarea
				id={id || internalId}
				onKeyDown={e => {
					if (e.key !== 'Escape') e.stopPropagation();
					onKeyDown?.(e);
				}}
				placeholder={label}
				className={cn('!ring-0 !border-border inset-shadow-xs w-48 shadow-none', className)}
				autoFocus
				{...props}
			/>
		</>
	);
}

function DropdownMenuCheckboxItem({
	className,
	children,
	checked,
	inset,
	checkbox,
	...props
}: MenuPrimitive.CheckboxItem.Props & {
	inset?: boolean;
	/** Whether to display an explicit checkbox component */
	checkbox?: boolean;
}) {
	return (
		<MenuPrimitive.CheckboxItem
			data-slot='dropdown-menu-checkbox-item'
			data-inset={inset}
			className={cn(
				"relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			checked={checked}
			{...props}
		>
			<span
				className='pointer-events-none absolute right-2 flex items-center justify-center'
				data-slot='dropdown-menu-checkbox-item-indicator'
			>
				{checkbox ? (
					<Checkbox checked={checked} />
				) : (
					<MenuPrimitive.CheckboxItemIndicator>
						<CheckIcon />
					</MenuPrimitive.CheckboxItemIndicator>
				)}
			</span>
			{children}
		</MenuPrimitive.CheckboxItem>
	);
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
	return <MenuPrimitive.RadioGroup data-slot='dropdown-menu-radio-group' {...props} />;
}

function DropdownMenuRadioItem({
	className,
	children,
	inset,
	...props
}: MenuPrimitive.RadioItem.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.RadioItem
			data-slot='dropdown-menu-radio-item'
			data-inset={inset}
			className={cn(
				"relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			<span
				className='pointer-events-none absolute right-2 flex items-center justify-center'
				data-slot='dropdown-menu-radio-item-indicator'
			>
				<MenuPrimitive.RadioItemIndicator>
					<CheckIcon />
				</MenuPrimitive.RadioItemIndicator>
			</span>
			{children}
		</MenuPrimitive.RadioItem>
	);
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
	return (
		<MenuPrimitive.Separator
			data-slot='dropdown-menu-separator'
			className={cn('pointer-events-none mx-1 my-1 border-t border-dotted', className)}
			{...props}
		/>
	);
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
	return (
		<span
			data-slot='dropdown-menu-shortcut'
			className={cn(
				'ml-auto text-muted-foreground text-xs tracking-widest group-focus/dropdown-menu-item:text-accent-foreground',
				className,
			)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
};
