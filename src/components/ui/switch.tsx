'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const switchVariants = cva(
	cn(
		'peer group/switch relative box-content inline-flex shrink-0 items-center outline-none',
		'after:absolute after:-inset-x-3 after:-inset-y-2',

		'data-disabled:cursor-not-allowed data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-50 dark:data-unchecked:bg-input/80',
		'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',

		'focus-visible:ring-2 focus-visible:ring-offset-1 aria-invalid:ring-2 aria-invalid:ring-offset-1',
		'transition-colors duration-200 ease-in-out-expo',
		'inset-shadow-xs rounded-md border',
	),
	{
		variants: {
			size: {
				sm: 'h-3 w-7 rounded-sm',
				default: 'h-4 w-9',
				lg: 'h-5 w-11',
			},
		},
		defaultVariants: { size: 'default' },
	},
);

const thumbVariants = cva(
	cn(
		'scheme-light pointer-events-none block bg-background dark:bg-foreground',
		'transition-transform duration-200 ease-in-out-quart',
		'scale-85 data-checked:translate-x-full data-unchecked:translate-x-0',
		'rounded-[5px] shadow-xs ring-1 ring-foreground/10',
	),
	{
		variants: {
			size: {
				sm: 'h-3 w-3.5 rounded-[3px]',
				default: 'h-4 w-4.5',
				lg: 'h-5 w-5.5',
			},
		},
		defaultVariants: { size: 'default' },
	},
);

function Switch({
	className,
	size = 'default',
	...props
}: SwitchPrimitive.Root.Props & {
	size?: 'sm' | 'default';
}) {
	return (
		<SwitchPrimitive.Root
			data-slot='switch'
			data-size={size}
			className={cn(switchVariants({ size, className }))}
			{...props}
		>
			<SwitchPrimitive.Thumb data-slot='switch-thumb' className={cn(thumbVariants({ size }))} />
		</SwitchPrimitive.Root>
	);
}

export { Switch };
