'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

import { cn } from '@/lib/utils';

function TooltipProvider(props: TooltipPrimitive.Provider.Props) {
	return <TooltipPrimitive.Provider data-slot='tooltip-provider' {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
	return <TooltipPrimitive.Root data-slot='tooltip' {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
	return <TooltipPrimitive.Trigger data-slot='tooltip-trigger' {...props} />;
}

function TooltipContent({
	className,
	side = 'top',
	sideOffset = 8,
	align = 'center',
	alignOffset = 0,
	children,
	...props
}: TooltipPrimitive.Popup.Props &
	Pick<TooltipPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				arrowPadding={6}
				collisionPadding={8}
				className='isolate z-50'
			>
				<TooltipPrimitive.Popup
					data-slot='tooltip-content'
					className={cn(
						'origin-(--transform-origin) select-none duration-200 ease-out-quart',
						'data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-95 motion-safe:data-starting-style:scale-95',
						'relative inset-0 z-50 w-fit text-balance rounded-sm bg-primary px-2 py-1 text-primary-foreground text-xs drop-shadow-xs',
						className,
					)}
					{...props}
				>
					{children}
					<TooltipPrimitive.Arrow
						className={cn(
							'fill-primary dark:fill-gray-900',
							'data-[side=bottom]:top-[0.3px] data-[side=left]:right-[0.3px] data-[side=top]:bottom-[0.3px] data-[side=right]:left-[0.3px] data-[side=bottom]:rotate-180 data-[side=left]:-rotate-90 data-[side=right]:rotate-90',
						)}
					>
						<Arrow className='translate-y-full' />
					</TooltipPrimitive.Arrow>
				</TooltipPrimitive.Popup>
			</TooltipPrimitive.Positioner>
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

export default function TextTooltip({
	content,
	className,

	side,
	align,

	render,
	delay,

	...props
}: {
	content: React.ReactNode;
	className?: string;
} & React.ComponentProps<typeof Tooltip> &
	Pick<TooltipPrimitive.Positioner.Props, 'align' | 'side'> &
	Pick<TooltipPrimitive.Trigger.Props, 'render' | 'delay'>) {
	return (
		<Tooltip {...props}>
			<TooltipTrigger render={render} delay={delay} className={className} />
			<TooltipContent side={side} align={align}>
				{content}
			</TooltipContent>
		</Tooltip>
	);
}

export { TextTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
