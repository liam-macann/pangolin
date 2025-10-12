'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type * as React from 'react';

import { cn } from '@/lib/utils';

function TooltipProvider({
	delayDuration = 0,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot='tooltip-provider'
			delayDuration={delayDuration}
			{...props}
		/>
	);
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	return (
		<TooltipProvider>
			<TooltipPrimitive.Root data-slot='tooltip' {...props} />
		</TooltipProvider>
	);
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot='tooltip-trigger' {...props} />;
}

function TooltipContent({
	className,
	sideOffset = -8,
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				data-slot='tooltip-content'
				sideOffset={sideOffset}
				className={cn(
					'fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
					'origin-(--radix-tooltip-content-transform-origin) animate-in data-[state=closed]:animate-out',
					'relative inset-0 z-50 w-fit text-balance rounded-sm bg-primary px-2 py-1 text-primary-foreground text-xs drop-shadow-xs',
					className,
				)}
				{...props}
			>
				{children}
				<TooltipPrimitive.Arrow className='fill-primary dark:fill-gray-900' asChild>
					<Arrow />
				</TooltipPrimitive.Arrow>
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
}

const Arrow = (props: React.JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>) => (
	<svg {...props} width='15' height='15' aria-hidden='true' viewBox='0 0 15 15'>
		<mask id='stroke-mask'>
			<rect x='0' y='0.5' width='15' height='15'></rect>
		</mask>
		<path
			d='M 0 0 L 0 0 C 1 0 2.739940073395944 0.6726727939963124 3.4798801467918876 1.3453455879926248 L 6.020119853208112 3.654654412007375 C 6.760059926604056 4.327327206003687 8.239940073395942 4.327327206003687 8.979880146791887 3.654654412007375 L 11.520119853208113 1.3453455879926248 C 12.260059926604058 0.6726727939963124 14 0 15 0 L 15 0'
			mask='url(#stroke-mask)'
			strokeWidth='1'
		></path>
		<path d='M 0 0 L 0 0 C 1 0 2.739940073395944 0.6726727939963124 3.4798801467918876 1.3453455879926248 L 6.020119853208112 3.654654412007375 C 6.760059926604056 4.327327206003687 8.239940073395942 4.327327206003687 8.979880146791887 3.654654412007375 L 11.520119853208113 1.3453455879926248 C 12.260059926604058 0.6726727939963124 14 0 15 0 L 15 0 M 15 -1 M 0 -1 Z'></path>
	</svg>
);

export { Tooltip, TextTooltip, TooltipTrigger, TooltipContent, TooltipProvider };

export default function TextTooltip({
	children,
	content,
	disabled = false,
	...props
}: {
	children: React.ReactNode;
	content: React.ReactNode;
	disabled?: boolean;
} & React.ComponentProps<typeof Tooltip>) {
	return (
		<Tooltip open={disabled ? false : undefined} {...props}>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent>{content}</TooltipContent>
		</Tooltip>
	);
}
