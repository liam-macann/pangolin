'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { CheckIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
	return (
		<CheckboxPrimitive.Root
			data-slot='checkbox'
			className={cn(
				'peer after:-inset-x-3 after:-inset-y-2 relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input shadow-xs outline-none after:absolute not-data-checked:focus-visible:border-ring focus-visible:ring disabled:cursor-not-allowed disabled:opacity-50 group-has-disabled/field:opacity-50 aria-invalid:border-destructive aria-invalid:ring aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-checked:ring-offset-1 data-checked:focus-visible:ring-2 dark:bg-input/30 dark:data-checked:bg-primary dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
				className,
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot='checkbox-indicator'
				className='grid place-content-center text-current transition-none [&>svg]:size-3.5'
			>
				<CheckIcon className='size-3.5' />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
