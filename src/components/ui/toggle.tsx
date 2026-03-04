'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/ui/button';

function Toggle({
	className,
	variant = 'outline',
	size,
	...props
}: TogglePrimitive.Props &
	VariantProps<typeof buttonVariants> & {
		variant?: 'ghost' | 'outline';
	}) {
	return (
		<TogglePrimitive
			data-slot='toggle'
			className={cn(
				buttonVariants({ variant, size }),
				'not-disabled:hover:bg-muted not-data-[state=on]:not-disabled:hover:text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
				className,
			)}
			{...props}
		/>
	);
}

export { Toggle };
