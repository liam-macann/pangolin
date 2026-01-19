'use no memo';
'use client';

import {
	CaretDownIcon,
	CaretUpDownIcon,
	CaretUpIcon,
	EyeSlashIcon,
} from '@phosphor-icons/react/ssr';
import type { Column } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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
				<DropdownMenuTrigger asChild>
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
				</DropdownMenuTrigger>
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
}: DataTableColumnHeaderProps<TData, TValue>) {
	if (!column.getCanSort()) {
		return <div className={cn(className)}>{title}</div>;
	}

	return (
		<Button
			onClick={column.getToggleSortingHandler()}
			variant='ghost'
			size='sm'
			className='-mx-2.5 !bg-transparent h-8 px-2.5'
		>
			<span>{title}</span>
			{column.getIsSorted() === 'desc' ? (
				<CaretDownIcon weight='bold' />
			) : (
				column.getIsSorted() === 'asc' && <CaretUpIcon weight='bold' />
			)}
		</Button>
	);
}
