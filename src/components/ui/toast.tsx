'use client';

import {
	type ToastManager,
	type ToastManagerAddOptions,
	type ToastManagerPromiseOptions,
	type ToastManagerUpdateOptions,
	Toast as ToastPrimitive,
} from '@base-ui/react/toast';
import {
	CheckCircleIcon,
	InfoIcon,
	WarningCircleIcon,
	WarningIcon,
	XIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import type * as React from 'react';
import { isValidElement } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ui/button';
import { Spinner } from '@/ui/spinner';

type ToastType = 'success' | 'info' | 'warning' | 'error' | 'loading';
type ToastManagerTypedOptions<Data extends object> = Omit<ToastManagerAddOptions<Data>, 'type'>;

import { isIterable } from 'es-toolkit';
import { isPortal } from 'react-is';

// This is *not* a well tested utility, and is not guaranteed to align with future React versions.
// Do NOT move to @/lib/utils without extensive tests.
function isReactNode(value: unknown): value is React.ReactNode {
	if (
		value === null ||
		value === undefined ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'bigint' ||
		typeof value === 'boolean' ||
		isValidElement(value) ||
		isPortal(value)
	) {
		return true;
	}

	if (typeof value === 'object') {
		// React 19 ReactNode includes promises
		if (value instanceof Promise) return true;

		// ReactNode accepts arbitrary iterables, not only arrays
		if (isIterable(value)) {
			for (const child of value) if (!isReactNode(child)) return false;
			return true;
		}
	}

	return false;
}

/** Creates a toast with a bound {@link ToastType} */
const withType =
	(type: ToastType | undefined) =>
	<Data extends object>(
		/** Toast title, or options object */
		arg: NonNullable<React.ReactNode | ToastManagerTypedOptions<Data>>,
	) => {
		// A bare title (string, element, etc.) is shorthand for `{ title }`
		// Anything else is treated as the full options object
		return toast.add<Data>({ ...(isReactNode(arg) ? { title: arg } : arg), type });
	};

function resolvePromiseSlot<Value, Data extends object>(
	slot: ToastManagerPromiseOptions<Value, Data>['loading' | 'success' | 'error'],
	value?: Value,
): ToastManagerUpdateOptions<Data> {
	const resolved = typeof slot === 'function' ? slot(value as Value) : slot;

	// Base UI declared type says `resolved` may only be `string | ToastManagerUpdateOptions<Data>`
	// but runtime allows ReactNode values to be passed
	if (isReactNode(resolved)) return { title: resolved as ToastManagerUpdateOptions<Data>['title'] };

	return resolved;
}

const toastManager = ToastPrimitive.createToastManager();

// A small shim that implements a Sonner-like toast API
const toast = Object.assign(withType(undefined), {
	...toastManager,
	success: withType('success'),
	info: withType('info'),
	warning: withType('warning'),
	error: withType('error'),
	loading: withType('loading'),

	// Mirrors Base UI promise signature, but forwards ReactNode to title, not description
	promise: <Value, Data extends object>(
		promiseValue: Promise<Value>,
		options: ToastManagerPromiseOptions<Value, Data>,
	) =>
		toastManager.promise<Value, Data>(promiseValue, {
			loading: resolvePromiseSlot(options.loading),
			success: result => resolvePromiseSlot(options.success, result),
			error: error => resolvePromiseSlot(options.error, error),
		}),
} satisfies ToastManager & Record<ToastType, ReturnType<typeof withType>>);

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
	return <ToastPrimitive.Provider {...props} />;
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
	return <ToastPrimitive.Portal data-slot='toast-portal' {...props} />;
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
	return (
		<ToastPrimitive.Viewport
			data-slot='toast-viewport'
			className={cn(
				'pointer-events-none fixed inset-x-4 bottom-6 z-50 mx-auto xs:max-w-sm outline-none',
				className,
			)}
			{...props}
		/>
	);
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
	return (
		<ToastPrimitive.Root
			data-slot='toast'
			swipeDirection='down'
			className={cn(
				'group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom select-none rounded-md border bg-popover text-popover-foreground shadow-[0_4px_12px_rgba(0,0,0,.1)] outline-none will-change-transform focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
				'[--gap:0.625rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.65rem] [--scale:calc(max(0,1-(var(--toast-index)*0.05)))] [--shrink:calc(1-var(--scale))]',
				'transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] h-(--height)',

				'[transition:transform_400ms_ease,opacity_400ms_ease,height_150ms]',
				'data-ending-style:[transition:transform_500ms_ease,opacity_200ms_ease,height_150ms]',
				'data-ending-style:data-swipe-direction:[transition:transform_200ms_ease-out,opacity_200ms_ease-out,height_150ms]',

				"after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
				'data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))] data-expanded:h-(--toast-height)',
				'data-starting-style:transform-[translateY(100%)] data-ending-style:opacity-0 data-limited:opacity-0 data-starting-style:opacity-0',

				'[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:transform-[translateY(100%)]',
				'data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%))]',
				'data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%))_translateY(var(--offset-y))]',
				'data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%))_translateY(var(--offset-y))]',
				'data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%))]',
				'data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%))]',
				'data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%))_translateY(var(--offset-y))]',
				'data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%))_translateY(var(--offset-y))]',
				'data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%))]',
				className,
			)}
			{...props}
		/>
	);
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
	return (
		<ToastPrimitive.Content
			data-slot='toast-content'
			className={cn(
				'flex h-full items-center gap-1.5 overflow-hidden p-4 transition-opacity duration-300 ease-in-out data-behind:opacity-0 data-expanded:opacity-100',
				className,
			)}
			{...props}
		/>
	);
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
	return (
		<ToastPrimitive.Title
			data-slot='toast-title'
			className={cn('font-medium text-[.8125rem]', className)}
			{...props}
		/>
	);
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
	return (
		<ToastPrimitive.Description
			data-slot='toast-description'
			className={cn('text-[.8125rem] text-muted-foreground', className)}
			{...props}
		/>
	);
}

function ToastAction({
	className,
	render = <Button variant='outline' size='xs' />,
	...props
}: ToastPrimitive.Action.Props) {
	return (
		<ToastPrimitive.Action
			data-slot='toast-action'
			render={render}
			className={cn('shrink-0', className)}
			{...props}
		/>
	);
}

function ToastClose({
	className,
	children,
	render = <Button variant='ghost' size='icon-xs' />,
	...props
}: ToastPrimitive.Close.Props) {
	return (
		<ToastPrimitive.Close
			data-slot='toast-close'
			aria-label='Close toast'
			render={render}
			className={cn(
				"relative shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground",
				className,
			)}
			{...props}
		>
			{children ?? <XIcon aria-hidden='true' />}
		</ToastPrimitive.Close>
	);
}

function ToastIcon({ type }: { type: string | undefined }) {
	let icon: React.ReactNode = null;

	switch (type) {
		case 'success':
			icon = <CheckCircleIcon aria-hidden='true' weight='fill' />;
			break;
		case 'info':
			icon = <InfoIcon aria-hidden='true' weight='fill' />;
			break;
		case 'warning':
			icon = <WarningIcon aria-hidden='true' weight='fill' />;
			break;
		case 'error':
			icon = <WarningCircleIcon aria-hidden='true' weight='fill' />;
			break;
		case 'loading':
			icon = <Spinner className='size-5 scale-90' aria-hidden='true' />;
			break;
	}

	if (!icon) return null;

	return (
		<AnimatePresence mode='popLayout' initial={false}>
			<motion.span
				key={type}
				initial={{ opacity: 0, scale: 0.8 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.8 }}
				transition={{ duration: 0.3, ease: 'easeInOut' }}
				data-slot='toast-icon'
				className="shrink-0 -translate-x-0.5 [&_svg:not([class*='size-'])]:size-5 [&_svg]:pointer-events-none"
			>
				{icon}
			</motion.span>
		</AnimatePresence>
	);
}

interface ListOptions {
	closeButton?: boolean;
}

function ToastList({ closeButton }: ListOptions) {
	const { toasts } = ToastPrimitive.useToastManager();

	return toasts.map(toastItem => (
		<Toast key={toastItem.id} toast={toastItem}>
			<ToastContent>
				<ToastIcon type={toastItem.type} />
				<div className='flex min-w-0 flex-1 flex-col gap-1'>
					<ToastTitle />
					<ToastDescription />
				</div>
				<ToastAction className='-my-2' />
				{closeButton && <ToastClose />}
			</ToastContent>
		</Toast>
	));
}

function Toaster({ children, toastManager = toast, ...props }: ToastPrimitive.Provider.Props) {
	return (
		<ToastProvider toastManager={toastManager} {...props}>
			{children}
			<ToastPortal>
				<ToastViewport>
					<ToastList closeButton={false} />
				</ToastViewport>
			</ToastPortal>
		</ToastProvider>
	);
}

const createToastManager = ToastPrimitive.createToastManager;
const useToastManager = ToastPrimitive.useToastManager;

export {
	createToastManager,
	Toast,
	ToastAction,
	ToastClose,
	ToastContent,
	ToastDescription,
	Toaster,
	ToastPortal,
	ToastProvider,
	ToastTitle,
	ToastViewport,
	toast,
	useToastManager,
};
