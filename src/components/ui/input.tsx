'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({
	className,
	type,
	prefix,
	suffix,
	...props
}: Omit<React.ComponentProps<'input'>, 'prefix' | 'suffix'> & {
	prefix?: React.ReactNode;
	suffix?: React.ReactNode;
}) {
	const ref = React.useRef<HTMLInputElement>(null);

	return (
		<span
			className={cn(
				'flex items-center text-base md:text-sm',
				'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50',
				'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground',
				'flex h-9 w-full min-w-0 rounded-md border border-input shadow-xs outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
				'bg-background dark:bg-input/30',
				'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
				className,
			)}
			onPointerDown={e => {
				if (ref.current) {
					e.preventDefault();
					ref.current.focus();
				}
			}}
		>
			{prefix && <div className='pointer-events-none ml-3 flex h-full items-center'>{prefix}</div>}
			<input
				ref={ref}
				type={type}
				data-slot='input'
				className={cn(
					'h-full w-full grow px-3 py-1 outline-none',
					prefix && 'pl-1.5',
					suffix && 'pr-1.5',
				)}
				{...props}
			/>
			{suffix && <div className='mr-3 flex h-full items-center'>{suffix}</div>}
		</span>
	);
}

export { Input };
