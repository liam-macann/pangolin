import { CaretDownIcon } from '@phosphor-icons/react/ssr';
import type { ComponentProps, ReactNode } from 'react';
import { cn, type ElementType } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
	Combobox,
	ComboboxClear,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxList,
	ComboboxPopup,
	ComboboxPositioner,
	ComboboxTrigger,
} from '.';

interface Item {
	value: string;
	label: ReactNode;
}

type Items = Item[] | string[];

export default function InlineCombobox({
	empty = 'No results found.',
	placeholder,
	required = false,
	className,
	...props
}: Omit<ComponentProps<typeof Combobox>, 'items'> & {
	items: Items;
	empty: ReactNode;
	placeholder?: string;
	required?: boolean;
	className?: string;
}) {
	return (
		<span className={cn('w-full', className)}>
			<Combobox {...props}>
				<div className='relative flex flex-col gap-2'>
					<ComboboxInput required={required} placeholder={placeholder} />
					<div className='absolute right-2 bottom-0 flex h-9 items-center justify-center text-muted-foreground'>
						{!required && <ComboboxClear />}
						<ComboboxTrigger
							className='text-inherit'
							aria-label='Open popup'
							render={<Button size='icon-xs' variant='ghost' />}
						>
							<CaretDownIcon />
						</ComboboxTrigger>
					</div>
				</div>
				<ComboboxPositioner sideOffset={6}>
					<ComboboxPopup>
						<ComboboxEmpty>{empty}</ComboboxEmpty>
						<ComboboxList>
							{(item: ElementType<Items>) => (
								<ComboboxItem key={typeof item === 'string' ? item : item.value} value={item}>
									<ComboboxItemIndicator />
									<div className='col-start-2'>{typeof item === 'string' ? item : item.label}</div>
								</ComboboxItem>
							)}
						</ComboboxList>
					</ComboboxPopup>
				</ComboboxPositioner>
			</Combobox>
		</span>
	);
}
