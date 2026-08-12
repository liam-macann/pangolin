'use client';

import styles from './drawer.module.css';

import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import type * as React from 'react';

import { cn } from '@/lib/utils';

import { DialogBackdrop } from './dialog';
import { ScrollArea } from './scroll-area';

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
	return <DrawerPrimitive.Root data-slot='drawer' {...props} />;
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
	return <DrawerPrimitive.Trigger data-slot='drawer-trigger' {...props} />;
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
	return <DrawerPrimitive.Portal data-slot='drawer-portal' {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
	return <DrawerPrimitive.Close data-slot='drawer-close' {...props} />;
}

function DrawerOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
	return (
		<DialogBackdrop
			data-slot='drawer-overlay'
			className={cn('opacity-[calc(0.75-var(--drawer-swipe-progress))]', className)}
			{...props}
			render={<DrawerPrimitive.Backdrop />}
		/>
	);
}

function DrawerContent({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
	return (
		<DrawerPortal data-slot='drawer-portal'>
			<DrawerOverlay />
			<DrawerPrimitive.Viewport data-slot='drawer-viewport' className='fixed inset-0 z-50'>
				<DrawerPrimitive.Popup
					data-slot='drawer-content'
					className={cn(
						styles.popup,
						'group/drawer-content',
						'pointer-events-auto fixed z-50 flex overflow-hidden',
						'data-[swipe-direction=left]:flex-row-reverse',
						'data-[swipe-direction=down]:flex-col data-[swipe-direction=up]:flex-col-reverse',
						'rounded-xl bg-background text-popover-foreground shadow-xl outline-none ring-1 ring-border **:ring-offset-background',
						'transition-transform duration-450 ease-[cubic-bezier(0.32,0.72,0,1)]',
						className,
					)}
					{...props}
				>
					<div
						className={cn(
							'm-auto size-1 shrink-0 rounded-full bg-border',
							'transition-opacity duration-300 ease-out group-data-nested-drawer-open/drawer-content:opacity-0 group-data-nested-drawer-swiping/drawer-content:opacity-100',
							'group-data-[swipe-direction=down]/drawer-content:w-12 group-data-[swipe-direction=up]/drawer-content:w-12',
							'group-data-[swipe-direction=down]/drawer-content:mt-2 group-data-[swipe-direction=up]/drawer-content:mb-2',
							'group-data-[swipe-direction=left]/drawer-content:h-12 group-data-[swipe-direction=right]/drawer-content:h-12',
							'group-data-[swipe-direction=left]/drawer-content:mr-2 group-data-[swipe-direction=right]/drawer-content:ml-2',
						)}
					/>
					<DrawerPrimitive.Content
						className='grid min-h-0'
						render={<ScrollArea fade={{ top: true }} />}
					>
						<div className='mx-auto max-w-5xl p-6'>{children}</div>
					</DrawerPrimitive.Content>
				</DrawerPrimitive.Popup>
			</DrawerPrimitive.Viewport>
		</DrawerPortal>
	);
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='drawer-header'
			className={cn(
				'mb-10 flex flex-col gap-2 group-data-[swipe-direction=down]/drawer-content:text-center group-data-[swipe-direction=up]/drawer-content:text-center md:gap-1.5 md:text-left',
				className,
			)}
			{...props}
		/>
	);
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='drawer-footer'
			className={cn('mt-auto flex flex-col gap-2', className)}
			{...props}
		/>
	);
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
	return (
		<DrawerPrimitive.Title
			data-slot='drawer-title'
			className={cn('font-semibold text-lg leading-none', className)}
			{...props}
		/>
	);
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
	return (
		<DrawerPrimitive.Description
			data-slot='drawer-description'
			className={cn('text-muted-foreground text-sm', className)}
			{...props}
		/>
	);
}

export {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerOverlay,
	DrawerPortal,
	DrawerTitle,
	DrawerTrigger,
};
