import { cva, type VariantProps } from 'class-variance-authority';
import { Slot as SlotPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
	cn(
		'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none',
		'transition ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
		"[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
	),
	{
		variants: {
			variant: {
				primary:
					'inset-shadow-white/10 inset-shadow-xs border border-black/10 bg-primary text-primary-foreground shadow-xs not-disabled:hover:bg-primary/90 not-disabled:active:scale-[98%]',
				destructive:
					'inset-shadow-white/10 inset-shadow-xs border border-black/10 bg-destructive-background text-white shadow-xs not-disabled:hover:bg-destructive-background/90 focus-visible:ring-destructive/20 not-disabled:active:scale-[98%] dark:focus-visible:ring-destructive/40',
				outline: [
					'border not-disabled:hover:text-accent-foreground not-disabled:active:scale-[98%] dark:border-input',
					'bg-linear-to-b from-80% from-transparent to-black/2 not-disabled:hover:bg-accent dark:bg-input/30 dark:not-disabled:hover:bg-input/50',
				],
				secondary:
					'inset-shadow-white/5 inset-shadow-xs border border-foreground/2 bg-secondary text-secondary-foreground not-disabled:hover:bg-secondary/80 not-disabled:active:scale-[98%]',
				ghost: 'text-accent-foreground not-disabled:hover:bg-accent',
				link: 'text-primary underline-offset-4 not-disabled:hover:underline',
			},
			size: {
				default: 'h-9 px-4 py-2 has-[>svg]:px-3',
				xs: "h-6 gap-1 rounded-md px-1.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5 [&_svg:not([class*='size-'])]:size-3",
				lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
				icon: 'size-9',
				'icon-xs': 'size-6',
				'icon-sm': 'size-8',
				'icon-lg': 'size-10',
			},
		},
		defaultVariants: {
			variant: 'outline',
			size: 'default',
		},
	},
);

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<'button'> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? SlotPrimitive.Slot : 'button';

	return (
		<Comp
			data-slot='button'
			className={cn(buttonVariants({ variant, size, className }))}
			type='button'
			{...props}
		/>
	);
}

export { Button, buttonVariants };
