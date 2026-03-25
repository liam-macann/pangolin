import { Input as InputPrimitive } from '@base-ui/react/input';
import type * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<typeof InputPrimitive>) {
	return (
		<InputPrimitive
			type={type}
			data-slot='input'
			className={cn(
				'h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1 font-normal text-base outline-none transition file:inline-flex file:h-7 file:border-0 file:bg-background file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring aria-invalid:ring-destructive/20 md:text-sm dark:bg-secondary dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
