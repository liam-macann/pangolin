'use client';

import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { type Sortable as SortableType } from '@dnd-kit/dom/sortable';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { SortableContext } from '@dnd-kit/sortable';
import { DotsSixIcon, DotsThreeIcon } from '@phosphor-icons/react';
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from 'motion/react';
import { createContext, type ReactNode, use, useRef } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/ui/dropdown-menu';

type Item = { id: string };
const ItemsContext = createContext<Item[]>([]);

export function Sortable({
	children,
	className,
	items,
	onReorder,
	disabled = false,
}: {
	children: ReactNode;
	className?: string;
	items: Item[];
	onReorder: (sortable: SortableType) => void;
	disabled?: boolean;
}) {
	return (
		<div
			className={cn('group/sortable flex flex-col gap-2', className)}
			data-empty={items.length === 0 || undefined}
			// Prevent AnimatePresence from triggering when transitioning between empty state
			key={items.length === 0 ? 'empty' : 'not-empty'}
		>
			<DragDropProvider
				onDragEnd={event => {
					const { operation, canceled } = event;
					const { source } = operation;

					if (canceled) return;
					if (isSortable(source)) onReorder(source.sortable);
				}}
			>
				<ItemsContext value={items}>
					<SortableContext items={items} disabled={items.length < 2 || disabled}>
						{children}
					</SortableContext>
				</ItemsContext>
			</DragDropProvider>
		</div>
	);
}

export function SortableList({
	className,
	children,
}: {
	className?: string;
	// biome-ignore lint/suspicious/noExplicitAny: Not possible to infer the type of the item from the context
	children: (item: any, index: number) => ReactNode;
}) {
	const items = use(ItemsContext);
	return (
		<LayoutGroup>
			<ul className={cn('-my-1 group-data-[empty]/sortable:hidden', className)}>
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
		<div
			data-slot='sortable-empty'
			className={cn('group-not-data-[empty]/sortable:hidden', className)}
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
}: SortableItemProps) {
	const ref = useRef<HTMLLIElement>(null);

	const isPresent = useIsPresent();

	const { isDragging, handleRef } = useSortable({
		id,
		index,
		element: ref,
		disabled,
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
		<SortableItemContext value={{ disabled, sortable: { isDragging, handleRef } }}>
			<motion.li
				className='group/sortable-item'
				ref={ref}
				variants={outer}
				initial='hidden'
				animate='visible'
				exit='hidden'
				layout
				layoutDependency={isPresent}
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

export function SortableHandle({ className, ...props }: React.ComponentProps<typeof Button>) {
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
		>
			<DotsSixIcon className='pointer-none inline-block self-center' />
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
					<Button size='icon' variant='outline'>
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
