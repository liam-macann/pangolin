'use client';

import type { VariantProps } from 'class-variance-authority';
import { Toggle as TogglePrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils/index';
import { buttonVariants } from '@/ui/button';

function Toggle({
	className,
	variant = 'outline',
	size,
	...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
	VariantProps<typeof buttonVariants> & {
		variant?: 'ghost' | 'outline';
	}) {
	return (
		<TogglePrimitive.Root
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
