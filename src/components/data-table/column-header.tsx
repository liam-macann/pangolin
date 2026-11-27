'use client';

import { type Column, type RowData } from '@tanstack/react-table';
import { type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { CaretDownIcon, CaretUpDownIcon, CaretUpIcon } from '@/icons';

import { type DataTableFeatures, useColumnState } from '@/components/data-table';
import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/ui/dropdown-menu';

interface DataTableColumnHeaderProps<TData extends RowData, TValue>
	extends React.HTMLAttributes<HTMLButtonElement | HTMLDivElement> {
	column: Column<DataTableFeatures, TData, TValue>;
	title: string;
	/** Inline side the column aligns to. An end-aligned header puts its icon before the title. */
	align?: 'start' | 'end';
}

/** The sort direction of a column, or an up-down caret when unsorted. */
export function SortIcon<TData extends RowData, TValue>({
	column,
	className,
}: Pick<DataTableColumnHeaderProps<TData, TValue>, 'column' | 'className'>) {
	const { direction, isSortable } = useColumnState(column, column => ({
		direction: column.getIsSorted(),
		isSortable: column.getCanSort(),
	}));

	if (!isSortable) return;

	switch (direction) {
		case 'desc':
			return <CaretDownIcon className={cn('translate-y-[0.5px]', className)} />;
		case 'asc':
			return <CaretUpIcon className={cn('translate-y-px', className)} />;
		default:
			return (
				<CaretUpDownIcon
					className={cn('not-in-[[data-slot="button"]:hover]:invisible', className)}
				/>
			);
	}
}

function HeaderButton({
	align,
	icon,
	children,
	className,
	...props
}: Pick<DataTableColumnHeaderProps<RowData, unknown>, 'align' | 'children'> & {
	icon: ReactNode;
} & ComponentProps<typeof Button>) {
	const content = [icon, <span key='label'>{children}</span>];

	return (
		<Button
			depress={false}
			variant='ghost'
			size='sm'
			className={cn('-mx-3! h-7.5 gap-1 bg-transparent! text-foreground!', className)}
			{...props}
		>
			{align === 'end' ? content : content.reverse()}
		</Button>
	);
}

export function DropdownHeader<TData extends RowData, TValue>({
	column,
	title,
	icon,
	children,
	...props
}: DataTableColumnHeaderProps<TData, TValue> & { icon?: ReactNode }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<HeaderButton icon={icon ?? <SortIcon column={column} />} {...props}>
						{title}
					</HeaderButton>
				}
			/>
			<DropdownMenuContent align='start'>{children}</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function ToggleHeader<TData extends RowData, TValue>({
	column,
	title,
	className,
	children,
	...props
}: // Title and children are mutually exclusive. Title prop is kept for consistency with TanStack API
	| (Omit<DataTableColumnHeaderProps<TData, TValue>, 'children'> & { children?: never })
	| (Omit<DataTableColumnHeaderProps<TData, TValue>, 'title'> & {
			title?: never;
			children: ReactNode;
	  })) {
	const { canSort } = useColumnState(column, column => ({ canSort: column.getCanSort() }));
	if (!canSort) return <div className={cn(className)}>{children || title}</div>;

	return (
		<HeaderButton
			onClick={column.getToggleSortingHandler()}
			icon={<SortIcon column={column} />}
			className={className}
			{...props}
		>
			{children || title}
		</HeaderButton>
	);
}
