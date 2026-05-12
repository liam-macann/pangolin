import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
	cn(
		'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none',
		'transition ease-out focus-visible:ring disabled:cursor-not-allowed disabled:opacity-50',
		"[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
		'*:data-[icon=inline-end]:-mr-0.5 *:data-[icon=inline-start]:-ml-0.5 *:[svg]:not-data-icon:first:-ml-0.5 *:[svg]:not-data-icon:last:-mr-0.5',
	),
	{
		variants: {
			variant: {
				primary:
					'inset-shadow-white/10 inset-shadow-xs border border-black/10 bg-primary text-primary-foreground shadow-xs ring-offset-1 not-disabled:hover:bg-primary/90 focus-visible:ring-2 not-disabled:active:motion-safe:scale-[98%]',
				destructive:
					'inset-shadow-white/10 inset-shadow-xs border border-black/10 bg-destructive-background text-white shadow-xs not-disabled:hover:bg-destructive-background/90 focus-visible:ring-destructive/20 not-disabled:active:motion-safe:scale-[98%] dark:focus-visible:ring-destructive/40',
				outline: [
					'border not-disabled:hover:text-accent-foreground focus-visible:border-ring not-disabled:active:motion-safe:scale-[98%]',
					'bg-linear-to-b from-80% from-transparent to-black/2 dark:bg-linear-to-t dark:bg-secondary dark:from-20% dark:to-white/2',
					'not-disabled:hover:bg-accent/70 dark:not-disabled:hover:bg-gray-4',
					'aria-expanded:bg-accent/70 aria-expanded:dark:bg-gray-4',
				],
				secondary: [
					'inset-shadow-white/15 not-dark:inset-shadow-xs',
					'border border-secondary-foreground/2 bg-secondary text-secondary-foreground not-disabled:hover:bg-secondary-2 focus-visible:border-ring not-disabled:active:motion-safe:scale-[98%]',
					'aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
				],
				ghost:
					'border border-transparent text-accent-foreground not-disabled:hover:bg-accent focus-visible:border-ring aria-expanded:bg-muted aria-expanded:text-foreground',
				link: 'text-primary underline-offset-4 not-disabled:hover:underline',
			},
			size: {
				default: 'h-9 gap-1.5 in-data-[slot=button-group]:rounded-md px-3.5',
				xs: "h-6 gap-1 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),8px)] px-1.5 text-xs [&_svg:not([class*='size-'])]:size-3",
				sm: 'h-8 gap-1.5 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),10px)] px-3',
				lg: 'h-10 gap-1.5 px-4',
				icon: 'size-9',
				'icon-xs':
					"size-6 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),8px)] [&_svg:not([class*='size-'])]:size-3",
				'icon-sm':
					'size-8 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),10px)]',
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
	size = 'default',
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			data-slot='button'
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
