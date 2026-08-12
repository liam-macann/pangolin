'use client';

import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';

import { cn } from '@/lib/utils';

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
	return (
		<RadioGroupPrimitive
			data-slot='radio-group'
			className={cn('grid w-full gap-3', className)}
			{...props}
		/>
	);
}

function RadioGroupItem({
	className,
	children,
	...props
}: RadioPrimitive.Root.Props & { children?: React.ReactNode }) {
	return (
		<RadioPrimitive.Root
			data-slot='radio-group-item'
			className={cn(
				'group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary data-checked:border-primary data-checked:text-primary-foreground dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [[data-slot="field-label"]_*]:not-group-data-disabled/radio-group:disabled:opacity-50',
				className,
			)}
			{...props}
		>
			<RadioPrimitive.Indicator
				data-slot='radio-group-indicator'
				className='relative flex size-full items-center justify-center'
			>
				{children || (
					<div className='-translate-1/2 absolute top-1/2 left-1/2 size-3 rounded-full bg-primary' />
				)}
			</RadioPrimitive.Indicator>
		</RadioPrimitive.Root>
	);
}

export { RadioGroup, RadioGroupItem };
