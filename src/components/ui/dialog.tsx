'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from '@phosphor-icons/react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root data-slot='dialog' {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot='dialog-trigger' {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return <DialogPrimitive.Portal data-slot='dialog-portal' {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot='dialog-close' {...props} />;
}

function DialogBackdrop({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
	return (
		<DialogPrimitive.Backdrop
			data-slot='dialog-overlay'
			className={cn(
				'absolute inset-0 z-50 bg-black/40 backdrop-contrast-80 duration-150 ease-out-quad data-ending-style:pointer-events-none data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/80',
				className,
			)}
			{...props}
		/>
	);
}

function DialogContent(
	props: React.ComponentProps<typeof DialogPrimitive.Popup> & {
		showCloseButton?: boolean;
	},
) {
	return (
		<DialogPortal data-slot='dialog-portal'>
			<DialogBackdrop />
			<DialogPopup {...props} />
		</DialogPortal>
	);
}

function DialogPopup({
	className,
	children,
	showCloseButton = true,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
	showCloseButton?: boolean;
}) {
	return (
		<DialogPrimitive.Popup
			data-slot='dialog-content'
			className={cn(
				'fixed top-[50%] left-[50%] z-50 grid max-h-[calc(100%-2rem)] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-scroll rounded-lg bg-background p-6 text-foreground shadow-lg ring-border **:ring-offset-background sm:max-w-lg dark:ring-1',
				'duration-150 ease-out-cubic data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-97 motion-safe:data-starting-style:scale-97',
				className,
			)}
			{...props}
		>
			{children}
			{showCloseButton && (
				<DialogPrimitive.Close
					data-slot='dialog-close'
					className='absolute top-4.5 right-4.5'
					render={
						<Button variant='ghost' size='icon-xs'>
							<XIcon />
							<span className='sr-only'>Close</span>
						</Button>
					}
				/>
			)}
		</DialogPrimitive.Popup>
	);
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='dialog-header'
			className={cn('flex flex-col gap-2 text-left', className)}
			{...props}
		/>
	);
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='dialog-footer'
			className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
			{...props}
		/>
	);
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot='dialog-title'
			className={cn('font-semibold text-lg leading-none', className)}
			{...props}
		/>
	);
}

function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot='dialog-description'
			className={cn('text-muted-foreground text-sm', className)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogBackdrop,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPopup,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
};
