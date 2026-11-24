'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from '@phosphor-icons/react';
import * as React from 'react';

import { cn, mergeRefs } from '@/lib/utils';

import { Button } from './button';
import './dialog.module.css';

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

/** Exposes dialog height as `--dialog-height`, and while frontmost also as `--dialog-frontmost-height`. */
function StackedPopup({
	frontmost,
	ref,
	...props
}: React.ComponentProps<'div'> & { frontmost: boolean }) {
	const element = React.useRef<HTMLDivElement>(null);

	React.useLayoutEffect(() => {
		const el = element.current;
		if (!el) return;

		// The first callback measures a new frontmost, which parents ease to. Later ones are resizes.
		let resize = false;

		const observer = new ResizeObserver(() => {
			const height = `${el.offsetHeight}px`;
			el.style.setProperty('--dialog-height', height);

			if (!frontmost) return;

			const root = document.documentElement;
			root.style.setProperty('--dialog-frontmost-height', height);

			// Suspends the stack transitions for this frame, so parents keep up with the resize
			if (resize) {
				root.toggleAttribute('data-dialog-resizing', true);
				requestAnimationFrame(() => root.removeAttribute('data-dialog-resizing'));
			}
			resize = true;
		});

		observer.observe(el);

		return () => observer.disconnect();
	}, [frontmost]);

	return <div ref={mergeRefs(ref, element)} {...props} />;
}

function DialogPopup({
	className,
	children,
	showCloseButton = true,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
	showCloseButton?: boolean;
}) {
	// Not inherited, so each layer eases its own copy and descendants skip the restyle
	const clipBottom =
		'[--dialog-clip-bottom:var(--dialog-nested-clip,0px)] transition-[--dialog-clip-bottom] duration-200 ease-out-cubic in-data-dialog-resizing:duration-0 motion-reduce:transition-none';

	return (
		<DialogPrimitive.Popup
			data-slot='dialog-content'
			render={(renderProps, { open, nestedDialogOpen }) => (
				<StackedPopup {...renderProps} frontmost={open && !nestedDialogOpen} />
			)}
			className={cn(
				'fixed inset-0 z-50 tall:mt-[-8vh] flex max-h-[calc(100%-2rem)] w-full max-w-[calc(100%-2rem)] flex-col place-self-center rounded-lg text-foreground **:ring-offset-background sm:max-w-lg',
				'data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-97 motion-safe:data-starting-style:scale-97',

				// Lines the scaled top up with the frontmost top, lifted by the peek, and clips to the frontmost height
				'scale-(--dialog-scale) [--dialog-scale:calc(1-0.05*var(--nested-dialogs))]',
				'[--dialog-peek:calc(var(--nested-dialogs)*(--spacing(4)))]',
				'translate-y-[calc(var(--dialog-scale)*var(--dialog-height)/2-var(--dialog-frontmost-height)/2-var(--dialog-peek))]',
				'[--dialog-nested-clip:max(0px,var(--dialog-height)-var(--dialog-frontmost-height)/var(--dialog-scale))]',

				'transition-[translate,scale,opacity] duration-200 in-data-dialog-resizing:duration-0 ease-out motion-reduce:transition-none',
				'data-nested:data-starting-style:translate-y-[calc(--spacing(5)+2.5%)] data-nested:data-starting-style:scale-105 data-starting-style:scale-95 data-starting-style:opacity-0',
				'data-nested:data-ending-style:translate-y-[calc(--spacing(5)+2.5%)] data-nested:data-ending-style:scale-105 data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-150',
				className,
			)}
			{...props}
		>
			{/* The visible card surface of the dialog. Height transitions independently of content (to match foremost nested dialog). */}
			<div
				aria-hidden
				data-slot='dialog-surface'
				className={cn(
					'absolute inset-0 bottom-(--dialog-clip-bottom) rounded-[inherit] bg-background shadow-lg ring-1 ring-border',
					clipBottom,
				)}
			/>

			<div
				data-slot='dialog-body'
				className={cn(
					'relative grid min-h-0 gap-4 overflow-scroll rounded-[inherit] p-6 [clip-path:inset(0_0_var(--dialog-clip-bottom)_0)]',
					clipBottom,
					'in-data-nested-dialog-open:opacity-0 transition-[opacity,--dialog-clip-bottom]',
				)}
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
			</div>
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
