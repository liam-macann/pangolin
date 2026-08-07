'use client';

import { DotsThreeIcon } from '@phosphor-icons/react';
import { type ReactNode, use } from 'react';

import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/ui/dropdown-menu';

import { SortableItemContext } from './context';

export function SortableActions({
	children,
	title = 'Actions',
	...props
}: {
	children: ReactNode;
	title?: ReactNode;
} & React.ComponentProps<typeof DropdownMenuContent>) {
	const itemContext = use(SortableItemContext);
	if (!itemContext) throw new Error('SortableActions must be used within a SortableItem');

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					// Without a SortableHandle, the whole <li> is the drag source. We want to avoid triggering drag-activation heuristic.

					// Stopping propagation also stops this event from reaching Base UI (onPointerDown).
					// Instead of stopping propagation, we mark the native event as already claimed (@dnd-kit/dom `PointerSensor`)
					<Button
						size='icon'
						variant='outline'
						onPointerDownCapture={e => Object.assign(e.nativeEvent, { sensor: undefined })}
					>
						<DotsThreeIcon />
						<span className='sr-only'>{title}</span>
					</Button>
				}
			/>
			<DropdownMenuContent {...props} className='min-w-min' side='right'>
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
