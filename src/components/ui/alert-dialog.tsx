'use client';

import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import type * as React from 'react';

import { cn } from '@/lib/utils';

import { buttonVariants } from '@/ui/button';

import { DialogBackdrop, DialogDescription, DialogPopup, DialogTitle } from './dialog';

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
	return <AlertDialogPrimitive.Root data-slot='alert-dialog' {...props} />;
}

function AlertDialogTrigger({
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
	return <AlertDialogPrimitive.Trigger data-slot='alert-dialog-trigger' {...props} />;
}

function AlertDialogPortal({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
	return <AlertDialogPrimitive.Portal data-slot='alert-dialog-portal' {...props} />;
}

function AlertDialogBackdrop({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Backdrop>) {
	return (
		<AlertDialogPrimitive.Backdrop
			render={DialogBackdrop}
			data-slot='alert-dialog-overlay'
			{...props}
		/>
	);
}

function AlertDialogContent({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Popup>) {
	return (
		<AlertDialogPortal>
			<AlertDialogBackdrop />
			<AlertDialogPrimitive.Popup
				render={DialogPopup}
				data-slot='alert-dialog-content'
				{...props}
			/>
		</AlertDialogPortal>
	);
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='alert-dialog-header'
			className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
			{...props}
		/>
	);
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='alert-dialog-footer'
			className={cn('mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
			{...props}
		/>
	);
}

function AlertDialogTitle({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
	return (
		<AlertDialogPrimitive.Title render={DialogTitle} data-slot='alert-dialog-title' {...props} />
	);
}

function AlertDialogDescription({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
	return (
		<AlertDialogPrimitive.Description
			render={DialogDescription}
			data-slot='alert-dialog-description'
			{...props}
		/>
	);
}

import { type VariantProps } from 'class-variance-authority';

function AlertDialogAction({
	className,
	variant = 'primary',
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Close> & {
	variant?: VariantProps<typeof buttonVariants>['variant'];
}) {
	return (
		<AlertDialogPrimitive.Close className={cn(buttonVariants({ variant }), className)} {...props} />
	);
}

function AlertDialogCancel({
	className,
	variant = 'secondary',
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Close> & {
	variant?: VariantProps<typeof buttonVariants>['variant'];
}) {
	return (
		<AlertDialogPrimitive.Close className={cn(buttonVariants({ variant }), className)} {...props} />
	);
}

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogBackdrop,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger,
};
