'use client';

import { InfoIcon } from '@phosphor-icons/react';
import * as Popover from '@radix-ui/react-popover';
import { useRef, useState } from 'react';
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
	const [open, setOpen] = useState(false);
	const pointerDown = useRef(false);

	return (
		<Popover.Root onOpenChange={setOpen} open={open}>
			<Popover.Trigger
				onPointerDown={() => {
					pointerDown.current = true;
				}}
				onPointerUp={() => {
					pointerDown.current = false;
				}}
				className='-m-1.5 group/info'
				onFocus={() => {
					if (!pointerDown.current) setOpen(true);
				}}
				asChild
			>
				<Button variant='ghost' size='icon-xs' className={cn('focus-visible:ring-0', className)}>
					<InfoIcon className='-m-px group-hover/info:!ring-0 size-3.5 cursor-pointer rounded-full text-muted-foreground ring-ring/50 group-focus-visible/info:ring-2' />
					<span className='sr-only'>Information</span>
				</Button>
			</Popover.Trigger>

			<PopoverContent
				onOpenAutoFocus={e => e.preventDefault()}
				onEscapeKeyDown={() => setOpen(false)}
				side={side}
				align={align}
				arrowPadding={8}
				collisionPadding={8}
			>
				{children}
			</PopoverContent>
		</Popover.Root>
	);
}

function PopoverContent({
	className,
	sideOffset = 4,
	children,
	...props
}: React.ComponentProps<typeof Popover.Content>) {
	return (
		<Popover.Portal>
			<Popover.Content
				data-slot='popover-content'
				sideOffset={sideOffset}
				className={cn(
					'max-w-[50vw] outline-none',
					'fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
					'origin-(--radix-popover-content-transform-origin) animate-in data-[state=closed]:animate-out',
					'relative inset-0 z-50 w-fit text-balance rounded-sm bg-primary px-2 py-1 text-primary-foreground text-xs drop-shadow-xs',
					className,
				)}
				{...props}
			>
				<Balancer preferNative={false}>{children}</Balancer>
				<Popover.Arrow className='pointer-events-none fill-primary dark:fill-gray-900' asChild>
					<Arrow />
				</Popover.Arrow>
			</Popover.Content>
		</Popover.Portal>
	);
}

const Arrow = (props: React.JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>) => (
	<svg {...props} width='15' height='5' aria-hidden='true' viewBox='0 0 15 5'>
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
