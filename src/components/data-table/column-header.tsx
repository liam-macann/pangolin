'use client';

import { CaretDownIcon, CaretUpDownIcon, CaretUpIcon } from '@phosphor-icons/react/ssr';
import { type Column, type RowData } from '@tanstack/react-table';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { type DataTableFeatures } from '@/components/data-table';
import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/ui/dropdown-menu';

interface DataTableColumnHeaderProps<TData extends RowData, TValue>
	extends React.HTMLAttributes<HTMLDivElement> {
	column: Column<DataTableFeatures, TData, TValue>;
	title: string;
}

export function DropdownHeader<TData extends RowData, TValue>({
	column,
	title,
	className,
	icon,
	children,
}: DataTableColumnHeaderProps<TData, TValue> & { icon?: ReactNode }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button depress={false} variant='ghost' size='sm' className={cn('-mx-3', className)}>
						<span>{title}</span>
						{icon ??
							(column.getIsSorted() === 'desc' ? (
								<CaretDownIcon />
							) : column.getIsSorted() === 'asc' ? (
								<CaretUpIcon />
							) : (
								<CaretUpDownIcon />
							))}
					</Button>
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
}: // Title and children are mutually exclusive. Title prop is kept for consistency with Tanstack API
	| (Omit<DataTableColumnHeaderProps<TData, TValue>, 'children'> & { children?: never })
	| (Omit<DataTableColumnHeaderProps<TData, TValue>, 'title'> & {
			title?: never;
			children: ReactNode;
	  })) {
	if (!column.getCanSort()) {
		return <div className={cn(className)}>{children || title}</div>;
	}

	return (
		<Button
			onClick={column.getToggleSortingHandler()}
			depress={false}
			variant='ghost'
			size='sm'
			className={cn('-mx-2! h-7 gap-1 bg-transparent! px-2! text-foreground!', className)}
		>
			<span>{children || title}</span>
			{(() => {
				switch (column.getIsSorted()) {
					case 'desc':
						return <CaretDownIcon className='translate-y-[0.5px]' />;
					case 'asc':
						return <CaretUpIcon className='translate-y-px' />;
				}
			})()}
		</Button>
	);
}
