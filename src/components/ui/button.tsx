import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const highlight = cn(
	'inset-ring-[0.5px] inset-ring-white/8 inset-shadow-sm inset-shadow-white/20 text-shadow-2xs',
	'bg-linear-to-b from-white/10 to-black/5 bg-blend-luminosity',
	'active:inset-shadow-xs active:from-transparent active:to-white/2',
);

const buttonVariants = cva(
	cn(
		'inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none',
		'transition duration-100 ease-out focus-visible:ring disabled:cursor-not-allowed disabled:opacity-50',
		"[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
		'*:data-[icon=inline-end]:-mr-0.5 *:data-[icon=inline-start]:-ml-0.5 not-data-[size^=icon-]:*:[svg]:not-data-icon:first:-ml-0.5 not-data-[size^=icon-]:*:[svg]:not-data-icon:last:-mr-0.5',
	),
	{
		variants: {
			variant: {
				primary: [
					'overflow-hidden border border-black/10 bg-primary text-primary-foreground shadow-xs dark:border-black/30',
					'not-disabled:hover:brightness-110 focus-visible:ring-2', // Interaction states
					highlight,
				],
				destructive: [
					'overflow-hidden border border-black/10 bg-destructive-background text-white shadow-xs',
					'not-disabled:hover:brightness-110 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40', // Interaction states
					highlight,
				],
				outline: [
					'border text-foreground focus-visible:border-ring',
					'bg-background bg-linear-to-b from-80% from-transparent to-black/2 dark:bg-linear-to-t dark:from-15% dark:to-white/4',
					'not-disabled:hover:bg-muted/70 aria-expanded:bg-muted/70', // Interaction states
				],
				secondary: [
					'bg-secondary text-secondary-foreground not-disabled:hover:bg-secondary-2 focus-visible:border-ring',
					'aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
				],
				ghost: [
					'border border-transparent text-foreground focus-visible:border-ring aria-expanded:bg-accent aria-expanded:text-accent-foreground',
					'not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground not-disabled:active:bg-accent', // Interaction states
				],
				link: 'text-primary underline-offset-4 not-disabled:hover:underline',
			},
			size: {
				default: 'h-9 gap-1.5 in-data-[slot=button-group]:rounded-md px-3.5',
				xs: 'h-6 gap-1 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),8px)] px-1.5 text-xs',
				sm: 'h-8 gap-1.5 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),10px)] px-3',
				lg: 'h-10 gap-1.5 px-4',
				icon: 'size-9',
				'icon-xs':
					'size-6 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),8px)]',
				'icon-sm':
					'size-8 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),10px)]',
				'icon-lg': 'size-10',
			},
			depress: {
				true: 'not-disabled:active:motion-safe:not-aria-[haspopup="menu"]:not-data-[slot="popover-trigger"]:scale-[98%]',
				false: '',
			},
		},
		defaultVariants: {
			variant: 'outline',
			size: 'default',
			depress: true,
		},
	},
);

function Button({
	className,
	variant,
	size = 'default',
	disabled,
	loading = false,
	depress = true,
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { loading?: boolean }) {
	return (
		<ButtonPrimitive
			data-slot='button'
			data-size={size}
			className={cn(
				buttonVariants({ variant, size, className, depress }),
				loading && 'disabled:cursor-progress',
			)}
			disabled={disabled || loading}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
