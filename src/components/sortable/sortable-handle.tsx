'use client';

import { DotsSixIcon } from '@phosphor-icons/react';
import { use } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';

import { SortableItemContext } from './context';

export function SortableHandle({
	className,
	...props
}: Omit<React.ComponentProps<typeof Button>, 'disabled'>) {
	const itemContext = use(SortableItemContext);
	if (!itemContext) throw new Error('SortableHandle must be used within a SortableItem');

	const {
		disabled,
		sortable: { handleRef },
	} = itemContext;

	return (
		<Button
			variant='link'
			size='icon'
			ref={handleRef}
			className={cn(
				'-mx-2 grow-0 touch-manipulation border border-transparent focus-visible:border-ring focus-visible:ring',
				disabled && 'cursor-not-allowed opacity-50',
				className,
			)}
			{...props}
			disabled={disabled}
		>
			<DotsSixIcon className='pointer-none inline-block self-center fill-foreground' />
			<span className='sr-only'>Reorder item</span>
		</Button>
	);
}
