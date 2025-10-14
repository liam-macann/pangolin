import type * as React from 'react';

import { cn } from '@/lib/utils';

function Input({
	className,
	type,
	prefix,
	suffix,
	...props
}: React.ComponentProps<'input'> & { prefix?: React.ReactNode; suffix?: React.ReactNode }) {
	return (
		<span className='relative text-base md:text-sm'>
			<input
				type={type}
				data-slot='input'
				className={cn(
					'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground',
					'flex h-9 w-full min-w-0 rounded-md border border-input px-3 py-1 shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50',
					'bg-background dark:bg-input/30',
					'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
					'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
					prefix && 'pl-7',
					suffix && 'pr-7',
					className,
				)}
				{...props}
			/>
			{prefix && (
				<div className='pointer-events-none absolute top-0 left-px ml-3 flex h-full items-center'>
					{prefix}
				</div>
			)}
			{suffix && (
				<div className='pointer-events-none absolute top-0 right-px mr-3 flex h-full items-center'>
					{suffix}
				</div>
			)}
		</span>
	);
}

export { Input };
