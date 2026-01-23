export * from '@base-ui/react/combobox';

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { CheckIcon, XIcon } from '@phosphor-icons/react/ssr';
import type { RefObject } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Separator } from '@/src/components/ui/separator';

const Combobox = <Value, Multiple extends boolean | undefined = false>(
	props: ComboboxPrimitive.Root.Props<Value, Multiple>,
) => <ComboboxPrimitive.Root autoHighlight {...props} />;

function ComboboxInput(
	props: ComboboxPrimitive.Input.Props & {
		ref?: RefObject<HTMLInputElement | null>;
	},
) {
	return (
		<ComboboxPrimitive.Input
			data-slot='combobox-input'
			render={<Input focusStyles={false} />}
			{...props}
		/>
	);
}

function ComboboxTrigger(props: ComboboxPrimitive.Trigger.Props) {
	return (
		<ComboboxPrimitive.Trigger
			data-slot='combobox-trigger'
			render={<Button className='not-disabled:active:motion-safe:scale-100' variant='outline' />}
			{...props}
		/>
	);
}

function ComboboxIcon({ className, ...props }: ComboboxPrimitive.Icon.Props) {
	return (
		<ComboboxPrimitive.Icon
			data-slot='combobox-icon'
			className={cn('ml-auto', className)}
			{...props}
		/>
	);
}

function ComboboxClear({ children, className, ...props }: ComboboxPrimitive.Clear.Props) {
	return (
		<ComboboxPrimitive.Clear
			className={cn('text-inherit', className)}
			aria-label='Clear selection'
			data-slot='combobox-clear'
			render={<Button size='icon-xs' variant='ghost' />}
			{...props}
		>
			{children ?? <XIcon className='size-4' />}
		</ComboboxPrimitive.Clear>
	);
}

function ComboboxValue(props: ComboboxPrimitive.Value.Props) {
	return <ComboboxPrimitive.Value data-slot='combobox-value' {...props} />;
}

function ComboboxChips({
	className,
	...props
}: ComboboxPrimitive.Chips.Props & { ref?: RefObject<HTMLDivElement | null> }) {
	return (
		<ComboboxPrimitive.Chips
			data-slot='combobox-chips'
			className={cn(
				'flex min-h-9 flex-wrap items-start gap-1 rounded-md border px-1.5 py-1.5 transition-[color,box-shadow]',
				'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxChip({ className, ...props }: ComboboxPrimitive.Chip.Props) {
	return (
		<ComboboxPrimitive.Chip
			data-slot='combobox-chip'
			className={cn(
				'flex cursor-default items-center gap-1 rounded-md bg-muted px-1 ps-2 pe-0 text-xs outline-none',
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxChipRemove({ className, children, ...props }: ComboboxPrimitive.ChipRemove.Props) {
	return (
		<ComboboxPrimitive.ChipRemove
			data-slot='combobox-chip-remove'
			className={cn('rounded-md p-1 text-inherit hover:bg-accent-foreground/10', className)}
			aria-label='Remove'
			{...props}
		>
			{children ?? <XIcon className='size-3.5' />}
		</ComboboxPrimitive.ChipRemove>
	);
}

function ComboboxPopup({ className, ...props }: ComboboxPrimitive.Popup.Props) {
	return (
		<ComboboxPrimitive.Popup
			data-slot='combobox-popup'
			className={cn(
				'row grid max-h-[min(var(--available-height),23rem)] w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) grid-rows-[auto_1fr] overflow-hidden rounded-md bg-popover shadow-md outline-1 outline-border transition-[transform,scale,opacity] data-[side=none]:data-[starting-style]:scale-100 data-[side=none]:data-[starting-style]:opacity-100 data-[side=none]:data-[ending-style]:transition-none data-[side=none]:data-[starting-style]:transition-none data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:shadow-none',
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxPositioner({ className, ...props }: ComboboxPrimitive.Positioner.Props) {
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner
				data-slot='combobox-positioner'
				className={cn('z-50 outline-none', className)}
				{...props}
			/>
		</ComboboxPrimitive.Portal>
	);
}

function ComboboxArrow(props: ComboboxPrimitive.Arrow.Props) {
	return <ComboboxPrimitive.Arrow data-slot='combobox-arrow' {...props} />;
}

function ComboboxStatus({ className, ...props }: ComboboxPrimitive.Status.Props) {
	return (
		<ComboboxPrimitive.Status
			data-slot='combobox-status'
			className={cn('px-4.5 py-2 text-muted-foreground text-sm empty:m-0 empty:p-0', className)}
			{...props}
		/>
	);
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
	return (
		<ComboboxPrimitive.Empty
			data-slot='combobox-empty'
			className={cn(
				'flex items-center justify-center not-empty:py-6 text-muted-foreground text-sm',
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
	return (
		<ComboboxPrimitive.List
			data-slot='combobox-list'
			className={cn(
				'min-h-0 scroll-py-1 overflow-x-hidden overflow-y-scroll overscroll-contain py-1 empty:hidden has-[[data-slot="combobox-group-label"]]:scroll-pt-8',
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxRow(props: ComboboxPrimitive.Row.Props) {
	return <ComboboxPrimitive.Row data-slot='combobox-row' {...props} />;
}

function ComboboxItem({ className, ...props }: ComboboxPrimitive.Item.Props) {
	return (
		<ComboboxPrimitive.Item
			data-slot='combobox-item'
			className={cn(
				'grid cursor-default select-none grid-cols-[0.95rem_1fr] items-center gap-2 py-2 pr-5 pl-4 text-sm leading-4 outline-none',
				'data-[highlighted]:before:-z-1 data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-accent-foreground data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-accent',
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxItemIndicator({
	className,
	children,
	...props
}: ComboboxPrimitive.ItemIndicator.Props) {
	return (
		<ComboboxPrimitive.ItemIndicator
			data-slot='combobox-item-indicator'
			className={cn('col-start-1', className)}
			{...props}
		>
			{children ?? <CheckIcon className='-translate-y-px size-4' />}
		</ComboboxPrimitive.ItemIndicator>
	);
}

function ComboboxSeparator(props: ComboboxPrimitive.Separator.Props) {
	return (
		<ComboboxPrimitive.Separator data-slot='combobox-separator' render={<Separator />} {...props} />
	);
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
	return (
		<ComboboxPrimitive.Group
			data-slot='combobox-group'
			className={cn('mb-3 last:mb-0', className)}
			{...props}
		/>
	);
}

function ComboboxGroupLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
	return (
		<ComboboxPrimitive.GroupLabel
			data-slot='combobox-group-label'
			className={cn(
				'-top-2 -mt-2 sticky z-1 mb-1 border-b bg-popover py-1 pt-3 pl-4 font-medium text-muted-foreground text-xs',
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxCollection(props: ComboboxPrimitive.Collection.Props) {
	return <ComboboxPrimitive.Collection data-slot='combobox-collection' {...props} />;
}

export {
	Combobox,
	ComboboxArrow,
	ComboboxChip,
	ComboboxChipRemove,
	ComboboxChips,
	ComboboxClear,
	ComboboxCollection,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxGroupLabel,
	ComboboxIcon,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxList,
	ComboboxPopup,
	ComboboxPositioner,
	ComboboxRow,
	ComboboxSeparator,
	ComboboxStatus,
	ComboboxTrigger,
	ComboboxValue,
};
