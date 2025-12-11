'use client';

import { CaretUpDownIcon, CheckIcon } from '@phosphor-icons/react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';

type Option = {
	value: string;
	label: string;
};

export function Combobox({
	noun = { singular: 'option', plural: 'options' },
	placeholder = `Select ${noun.singular}`,
	options,
	value,
	disabled = false,
	onChange,
	className,

	align = 'end',
	...props
}: {
	noun?: { singular: string; plural: string };
	placeholder?: string;
	options: Option[];
	value: string;
	disabled?: boolean;
	onChange?: (value: string) => void;
	className?: string;
} & React.ComponentProps<typeof PopoverContent>) {
	const [open, setOpen] = React.useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant='outline'
					role='combobox'
					aria-expanded={open}
					className={cn(
						'w-full justify-between not-disabled:active:motion-safe:scale-100',
						className,
					)}
					disabled={disabled}
				>
					<div className='truncate'>
						{value ? options.find(option => option.value === value)?.label : `${placeholder}…`}
					</div>
					<CaretUpDownIcon className='ml-2 h-4 w-4 shrink-0 opacity-50' />
				</Button>
			</PopoverTrigger>
			<PopoverContent align={align} {...props} className='w-[200px] p-0'>
				<Command>
					<CommandInput placeholder={`Search ${noun.plural}…`} />
					<CommandList>
						<CommandEmpty>No {noun.singular} found.</CommandEmpty>
						<CommandGroup>
							{options.map(option => (
								<CommandItem
									key={option.value}
									value={option.value}
									keywords={[option.label]}
									onSelect={currentValue => {
										onChange?.(currentValue === value ? '' : currentValue);
										setOpen(false);
									}}
								>
									<CheckIcon
										className={cn(
											'mr-2 h-4 w-4',
											value === option.value ? 'opacity-100' : 'opacity-0',
										)}
									/>
									{option.label}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
