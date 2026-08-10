'use client';

import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { type Sortable as SortableType } from '@dnd-kit/dom/sortable';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { DotsSixIcon, DotsThreeIcon } from '@phosphor-icons/react';
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from 'motion/react';
import { type ComponentProps, createContext, type ReactNode, use, useRef } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/ui/dropdown-menu';

import { Empty } from './ui/empty';

type Item = { id: string };
const SortableContext = createContext<{ items: Item[]; disabled: boolean }>({
	items: [],
	disabled: false,
});

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

export function SortableList({
	className,
	children,
	...props
}: {
	// biome-ignore lint/suspicious/noExplicitAny: Not possible to infer the type of the item from the context
	children: (item: any, index: number) => ReactNode;
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

/** Visible when there are no items in the sortable list */
export function SortableEmpty({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<Empty
			data-slot='empty'
			className={cn(
				'flex flex-row justify-between border p-6 py-7 group-not-data-empty/sortable:hidden',
				className,
			)}
			{...props}
		/>
	);
}

interface SortableItemContext {
	disabled: boolean;

	/** Returned methods from the useSortable hook */
	sortable: Pick<ReturnType<typeof useSortable>, 'isDragging' | 'handleRef'>;
}
const SortableItemContext = createContext<SortableItemContext | null>(null);

interface SortableItemProps {
	id: string;
	index: number;
	children: ReactNode;
	disabled?: boolean;
	className?: string;
}

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
			<DotsSixIcon className='pointer-none inline-block self-center fill-inherit' />
			<span className='sr-only'>Reorder item</span>
		</Button>
	);
}

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
