'use client';
import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import type { Sortable as SortableType } from '@dnd-kit/dom/sortable';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { SortableContext } from '@dnd-kit/sortable';
import { DotsSixIcon, DotsThreeIcon } from '@phosphor-icons/react';
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from 'motion/react';
import { Slot as SlotPrimitive } from 'radix-ui';
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

export function SortableEmpty({
	className,
	asChild = false,
	...props
}: React.ComponentProps<'div'> & {
	asChild?: boolean;
}) {
	const Comp = asChild ? SlotPrimitive.Slot : 'div';

	return <Comp className={cn('group-not-data-[empty]/sortable:hidden', className)} {...props} />;
}

const SortableItemContext = createContext({ isDragging: false });

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
		<SortableItemContext value={{ isDragging }}>
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
					className={cn(
						'relative flex origin-top gap-2 py-1 *:duration-200',
						isDragging && '*:drop-shadow-black/7 *:not-[.drop-shadow-none]:drop-shadow-md',
						className,
					)}
					variants={inner}
				>
					<Button
						variant='link'
						className={cn(
							'focus:!ring-0 group w-6 grow-0 touch-manipulation',
							disabled && 'cursor-not-allowed opacity-50',
						)}
						size='icon'
						ref={handleRef}
					>
						<DotsSixIcon
							className={cn(
								'inline-block size-6 h-8 self-center',
								'pointer-none rounded p-1 group-focus-visible:ring-2 group-focus-visible:ring-ring/50',
							)}
						/>
					</Button>
					{children}
				</motion.div>
			</motion.li>
		</SortableItemContext>
	);
}

export function SortableActions({
	children,
	heading = 'Actions',
}: {
	children: ReactNode;
	heading?: ReactNode;
}) {
	const { isDragging } = use(SortableItemContext);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size='icon'
					className={cn(isDragging && 'border-ring/70', 'bg-background')}
					variant='outline'
				>
					<DotsThreeIcon />
					<span className='sr-only'>{heading}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className='min-w-0' side='right'>
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
