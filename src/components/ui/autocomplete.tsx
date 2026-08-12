import { Autocomplete as AutocompletePrimitive } from '@base-ui/react/autocomplete';
import { XIcon } from '@phosphor-icons/react/ssr';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';
import { Input } from '@/ui/input';

function Autocomplete<T>({
	autoHighlight = true,
	...props
}: Omit<AutocompletePrimitive.Root.Props<T>, 'items'> & { items: T[] }) {
	return <AutocompletePrimitive.Root autoHighlight={autoHighlight} {...props} />;
}

function AutocompleteInput(props: AutocompletePrimitive.Input.Props) {
	return (
		<AutocompletePrimitive.Input data-slot='autocomplete-input' render={<Input />} {...props} />
	);
}

function AutocompletePopup({ className, ...props }: AutocompletePrimitive.Popup.Props) {
	return (
		<AutocompletePrimitive.Popup
			data-slot='autocomplete-popup'
			className={cn(
				'max-h-[min(var(--available-height),23rem)] w-(--anchor-width) max-w-(--available-width) scroll-pt-2 scroll-pb-2 overflow-y-auto overscroll-contain rounded-md bg-popover text-popover-foreground shadow-md outline-1 outline-border dark:shadow-none',
				className,
			)}
			{...props}
		/>
	);
}

function AutocompletePositioner({ className, ...props }: AutocompletePrimitive.Positioner.Props) {
	return (
		<AutocompletePrimitive.Portal>
			<AutocompletePrimitive.Positioner
				data-slot='autocomplete-positioner'
				className={cn('z-50', className)}
				{...props}
			/>
		</AutocompletePrimitive.Portal>
	);
}

function AutocompleteList({ className, ...props }: AutocompletePrimitive.List.Props) {
	return (
		<AutocompletePrimitive.List
			data-slot='autocomplete-list'
			className={cn('not-empty:p-1', className)}
			{...props}
		/>
	);
}

function AutocompleteEmpty({ className, ...props }: AutocompletePrimitive.Empty.Props) {
	return (
		<AutocompletePrimitive.Empty
			data-slot='autocomplete-empty'
			className={cn(
				'flex items-center justify-center not-empty:py-2.5 text-muted-foreground text-sm',
				className,
			)}
			{...props}
		/>
	);
}

function AutocompleteItem({ className, ...props }: AutocompletePrimitive.Item.Props) {
	return (
		<AutocompletePrimitive.Item
			data-slot='autocomplete-item'
			className={cn(
				"relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
				'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
				className,
			)}
			{...props}
		/>
	);
}

function AutocompleteGroup({ className, ...props }: AutocompletePrimitive.Group.Props) {
	return (
		<AutocompletePrimitive.Group
			data-slot='autocomplete-group'
			className={cn('block not-last:pb-2', className)}
			{...props}
		/>
	);
}

function AutocompleteGroupLabel({ className, ...props }: AutocompletePrimitive.GroupLabel.Props) {
	return (
		<AutocompletePrimitive.GroupLabel
			data-slot='autocomplete-group-label'
			className={cn(
				'sticky top-0 z-1',
				'bg-popover py-1.5 pl-2 font-medium text-muted-foreground text-sm',
				className,
			)}
			{...props}
		/>
	);
}

function AutocompleteCollection({ ...props }: AutocompletePrimitive.Collection.Props) {
	return <AutocompletePrimitive.Collection data-slot='autocomplete-collection' {...props} />;
}

function AutocompleteStatus({ className, ...props }: AutocompletePrimitive.Status.Props) {
	return (
		<AutocompletePrimitive.Status
			data-slot='autocomplete-status'
			className={cn('my-3 px-4.5 text-muted-foreground text-sm empty:m-0 empty:p-0', className)}
			{...props}
		/>
	);
}

function AutocompleteClear({ className, children, ...props }: AutocompletePrimitive.Clear.Props) {
	return (
		<AutocompletePrimitive.Clear
			data-slot='autocomplete-clear'
			className={cn(className)}
			{...props}
		>
			{children ?? <XIcon className='h-4 w-4 text-muted-foreground' />}
		</AutocompletePrimitive.Clear>
	);
}

function AutocompleteRow({ className, ...props }: AutocompletePrimitive.Row.Props) {
	return (
		<AutocompletePrimitive.Row data-slot='autocomplete-row' className={cn(className)} {...props} />
	);
}

function AutocompleteTrigger({ className, ...props }: AutocompletePrimitive.Trigger.Props) {
	return (
		<AutocompletePrimitive.Trigger
			data-slot='autocomplete-trigger'
			className={cn(className)}
			render={<Button variant='outline' />}
			{...props}
		/>
	);
}

export {
	Autocomplete,
	AutocompleteClear,
	AutocompleteCollection,
	AutocompleteEmpty,
	AutocompleteGroup,
	AutocompleteGroupLabel,
	AutocompleteInput,
	AutocompleteItem,
	AutocompleteList,
	AutocompletePopup,
	AutocompletePositioner,
	AutocompleteRow,
	AutocompleteStatus,
	AutocompleteTrigger,
};
