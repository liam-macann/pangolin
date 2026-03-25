'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { InfoIcon } from '@phosphor-icons/react';
import Balancer from 'react-wrap-balancer';

import { cn } from '@/lib/utils';

import { Button } from './ui/button';

export function InfoTip({
	children,
	className,
	side,
	align,
}: { className?: string; children: React.ReactNode } & Pick<
	React.ComponentProps<typeof PopoverContent>,
	'side' | 'align'
>) {
	return (
		<PopoverPrimitive.Root>
			<PopoverPrimitive.Trigger
				openOnHover
				className='group/info -m-1.5'
				render={
					<Button
						variant='ghost'
						size='icon-xs'
						className={cn('!border-transparent !ring-0 !bg-transparent', className)}
					>
						<InfoIcon className='-m-px size-3.5 cursor-pointer rounded-full text-muted-foreground ring-offset-1 group-focus-visible/info:ring-2' />
						<span className='sr-only'>Information</span>
					</Button>
				}
			/>

			<PopoverContent side={side} align={align}>
				{children}
			</PopoverContent>
		</PopoverPrimitive.Root>
	);
}

function PopoverContent({
	className,
	align = 'center',
	alignOffset = 0,
	side = 'bottom',
	sideOffset = 4,
	children,
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> &
	Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				arrowPadding={8}
				collisionPadding={8}
				className='isolate z-50'
			>
				<PopoverPrimitive.Popup
					data-slot='tooltip-content'
					className={cn(
						'data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 duration-200 ease-out-quart',
						'data-[side=bottom]:slide-in-from-top-1 data-[side=inline-end]:slide-in-from-left-1 data-[side=inline-start]:slide-in-from-right-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
						'origin-(--transform-origin) data-[state=delayed-open]:animate-in data-closed:animate-out data-open:animate-in',
						'z-50 w-fit max-w-xs rounded-md bg-foreground px-3 py-1.5 text-background text-xs outline-none',
						'relative inset-0 z-50 w-fit text-balance rounded-sm bg-primary px-2 py-1 text-primary-foreground text-xs drop-shadow-xs',
						className,
					)}
					{...props}
				>
					<Balancer preferNative={false}>{children}</Balancer>
					<PopoverPrimitive.Arrow
						className={cn(
							'fill-primary dark:fill-gray-900',
							'data-[side=bottom]:top-[0.3px] data-[side=left]:right-[0.3px] data-[side=top]:bottom-[0.3px] data-[side=right]:left-[0.3px] data-[side=bottom]:rotate-180 data-[side=left]:-rotate-90 data-[side=right]:rotate-90',
						)}
					>
						<Arrow className='translate-y-full' />
					</PopoverPrimitive.Arrow>
				</PopoverPrimitive.Popup>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
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
