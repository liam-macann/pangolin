'use client';

import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { useSortable } from '@dnd-kit/react/sortable';
import { motion, useIsPresent } from 'motion/react';
import { type ComponentProps, type ReactNode, use, useRef } from 'react';

import { cn } from '@/lib/utils';

import { SortableContext, SortableItemContext } from './context';

interface SortableItemProps {
	id: string;
	index: number;
	children: ReactNode;
	disabled?: boolean;
	className?: string;
}

const transition = {
	type: 'spring',
	mass: 0.2,
	stiffness: 300,
	damping: 15,
} as const;

const outer = {
	visible: {
		opacity: 1,
		height: 'auto',
		pointerEvents: 'auto',
		transition,
	},
	hidden: {
		opacity: 0,
		height: 0,
		pointerEvents: 'none',
		transition,
	},
};

const inner = {
	visible: {
		scale: 1,
		filter: 'blur(0px)',
		transition,
	},
	hidden: {
		scale: 0.97,
		filter: 'blur(4px)',
		transition,
	},
};

export function SortableItem({
	id,
	index,
	children,
	disabled = false,
	className,
	...props
}: SortableItemProps &
	Omit<ComponentProps<'li'>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'>) {
	const ref = useRef<HTMLLIElement>(null);

	const isPresent = useIsPresent();
	const { disabled: sortableDisabled } = use(SortableContext);
	const isDisabled = disabled || sortableDisabled;

	const { isDragging, handleRef } = useSortable({
		id,
		index,
		element: ref,
		disabled: isDisabled,
		modifiers: [
			RestrictToVerticalAxis,
			RestrictToElement.configure({ element: ref.current?.parentElement }),
		],
	});

	return (
		<SortableItemContext value={{ disabled: isDisabled, sortable: { isDragging, handleRef } }}>
			<motion.li
				className='group/sortable-item'
				ref={ref}
				// Without this, role="button" computes its accessible name from content, colliding with nested controls
				aria-label={`Item ${index + 1}`}
				variants={outer}
				initial='hidden'
				animate='visible'
				exit='hidden'
				layout
				layoutDependency={isPresent}
				{...props}
			>
				<motion.div
					variants={inner}
					className={cn(
						'relative flex origin-top gap-2 py-1 *:duration-200',
						isDragging && '*:not-[.drop-shadow-none]:drop-shadow-md',
						className,
					)}
				>
					{children}
				</motion.div>
			</motion.li>
		</SortableItemContext>
	);
}
