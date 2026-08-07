'use client';

import { AnimatePresence, LayoutGroup } from 'motion/react';
import { type ComponentProps, use } from 'react';

import { cn } from '@/lib/utils';

import { SortableContext } from './context';

export function SortableList({
	className,
	children,
	...props
}: {
	// biome-ignore lint/suspicious/noExplicitAny: Not possible to infer the type of the item from the context
	children: (item: any, index: number) => React.ReactNode;
} & Omit<ComponentProps<'ul'>, 'children'>) {
	const { items } = use(SortableContext);
	return (
		<LayoutGroup>
			<ul className={cn('-my-1 group-data-empty/sortable:hidden', className)} {...props}>
				<AnimatePresence initial={false}>
					{items.map((item, i) => children(item, i))}
				</AnimatePresence>
			</ul>
		</LayoutGroup>
	);
}
