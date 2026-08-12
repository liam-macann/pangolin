'use no memo';
'use client';

import {
	CaretDownIcon,
	CaretUpDownIcon,
	CaretUpIcon,
	EyeSlashIcon,
} from '@phosphor-icons/react/ssr';
import { type Column } from '@tanstack/react-table';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
	column: Column<TData, TValue>;
	title: string;
}

export function DropdownHeader<TData, TValue>({
	column,
	title,
	className,
}: DataTableColumnHeaderProps<TData, TValue>) {
	if (!column.getCanSort()) {
		return <div className={cn(className)}>{title}</div>;
	}

	return (
		<div className={cn('flex items-center gap-2', className)}>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant='ghost' size='sm' className='-mx-2.5 h-8 data-[state=open]:bg-accent'>
							<span>{title}</span>
							{column.getIsSorted() === 'desc' ? (
								<CaretDownIcon weight='bold' />
							) : column.getIsSorted() === 'asc' ? (
								<CaretUpIcon weight='bold' />
							) : (
								<CaretUpDownIcon />
							)}
						</Button>
					}
				/>
				<DropdownMenuContent align='start'>
					<DropdownMenuItem onClick={() => column.toggleSorting(false)}>
						<CaretUpIcon />
						Asc
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => column.toggleSorting(true)}>
						<CaretDownIcon />
						Desc
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
						<EyeSlashIcon />
						Hide
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export function ToggleHeader<TData, TValue>({
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
			variant='ghost'
			size='sm'
			className={cn('-mx-2! h-7 gap-1 bg-transparent! px-2!', className)}
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
