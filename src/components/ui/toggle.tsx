'use client';

import * as TogglePrimitive from '@radix-ui/react-toggle';
import type { VariantProps } from 'class-variance-authority';
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
				'data-[state=on]:!text-accent-foreground not-disabled:hover:bg-muted not-disabled:hover:text-muted-foreground data-[state=on]:bg-accent',
				className,
			)}
			{...props}
		/>
	);
}

export { Toggle };
