'use client';

import { type Sortable as SortableType } from '@dnd-kit/dom/sortable';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { type Item, SortableContext } from './context';

export function Sortable({
	children,
	className,
	items,
	onReorder,
	disabled = false,
	...props
}: {
	children: ReactNode;
	className?: string;
	items: Item[];
	onReorder: (sortable: SortableType) => void;
	disabled?: boolean;
} & ComponentProps<'div'>) {
	return (
		<div
			className={cn('group/sortable flex flex-col gap-2', className)}
			data-empty={items.length === 0 || undefined}
			// Prevent AnimatePresence from triggering when transitioning between empty state
			key={items.length === 0 ? 'empty' : 'not-empty'}
			{...props}
		>
			<DragDropProvider
				onDragEnd={event => {
					const { operation, canceled } = event;
					const { source } = operation;

					if (canceled) return;
					if (isSortable(source)) onReorder(source.sortable);
				}}
			>
				<SortableContext value={{ items, disabled: items.length < 2 || disabled }}>
					{children}
				</SortableContext>
			</DragDropProvider>
		</div>
	);
}
