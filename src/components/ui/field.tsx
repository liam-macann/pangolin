'use client';

import { mergeProps, useRender } from '@base-ui/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ReactNode, useMemo } from 'react';
import { type FieldError as ErrorRHF } from 'react-hook-form';

import { cn } from '@/lib/utils';

import { Label } from '@/ui/label';
import { Separator } from '@/ui/separator';

function FieldSet({ className, ...props }: React.ComponentProps<'fieldset'>) {
	return (
		<fieldset
			data-slot='field-set'
			className={cn(
				'flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3',
				className,
			)}
			{...props}
		/>
	);
}

function FieldLegend({
	className,
	variant = 'legend',
	...props
}: React.ComponentProps<'legend'> & { variant?: 'legend' | 'label' }) {
	return (
		<legend
			data-slot='field-legend'
			data-variant={variant}
			className={cn(
				'font-medium data-[variant=legend]:mb-1 data-[variant=legend]:font-semibold data-[variant=label]:text-sm data-[variant=legend]:text-base',
				className,
			)}
			{...props}
		/>
	);
}

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='field-group'
			className={cn(
				'group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4',
				className,
			)}
			{...props}
		/>
	);
}

const fieldVariants = cva(
	'group/field flex w-full gap-2 gap-x-4 data-[invalid=true]:text-destructive',
	{
		variants: {
			orientation: {
				vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
				horizontal:
					'flex-row items-center has-[>[data-slot=field-content]>*+*]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
				responsive: [
					'@md/field-group:flex-row flex-col @md/field-group:items-center *:w-full @md/field-group:*:w-auto [&>.sr-only]:w-auto',
					'@md/field-group:*:data-[slot=field-label]:flex-auto',
					'@md/field-group:has-[>[data-slot=field-content]>*+*]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
				],
			},
		},
		defaultVariants: {
			orientation: 'vertical',
		},
	},
);

function Field({
	className,
	orientation = 'vertical',
	...props
}: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: FieldSet export already exists
		<div
			role='group'
			data-slot='field'
			data-orientation={orientation}
			className={cn(fieldVariants({ orientation }), className)}
			{...props}
		/>
	);
}

function FieldContent({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='field-content'
			className={cn('group/field-content flex flex-1 flex-col gap-1 leading-snug', className)}
			{...props}
		/>
	);
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
	return (
		<Label
			data-slot='field-label'
			className={cn(
				'group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50',
				'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border has-[>[data-slot=field]]:group-data-disabled/radio-group:cursor-not-allowed has-[>[data-slot=field]]:group-data-disabled/radio-group:opacity-50',
				'has-data-checked:border-primary/30 has-data-checked:bg-primary/5 *:data-[slot=field]:p-3 *:data-[slot=field]:px-3.5 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10',
				className,
			)}
			{...props}
		/>
	);
}

function FieldTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='field-label'
			className={cn(
				'flex w-fit select-none items-center gap-2 font-medium text-sm leading-snug group-data-[disabled=true]/field:opacity-50',
				className,
			)}
			{...props}
		/>
	);
}

function FieldDescription({ render, ...props }: useRender.ComponentProps<'p'>) {
	const element = useRender({
		defaultTagName: 'p',
		render,
		props: mergeProps<'p'>(
			{
				...({ 'data-slot': 'field-description' } as React.HTMLAttributes<HTMLParagraphElement>),
				className: cn(
					'text-left font-normal text-muted-foreground text-sm leading-normal group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5',
					'nth-last-2:-mt-1 last:mt-0',
					'[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
				),
			},
			props,
		),
	});

	return element;
}

function FieldSeparator({
	children,
	className,
	...props
}: React.ComponentProps<'div'> & {
	children?: React.ReactNode;
}) {
	return (
		<div
			data-slot='field-separator'
			data-content={!!children}
			className={cn(
				'relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2',
				className,
			)}
			{...props}
		>
			<Separator className='absolute inset-0 top-1/2' />
			{children && (
				<span
					className='relative mx-auto block w-fit bg-background px-2 text-muted-foreground'
					data-slot='field-separator-content'
				>
					{children}
				</span>
			)}
		</div>
	);
}

type Error = { message?: string } | ErrorRHF | undefined;
function FieldError({
	className,
	children,
	errors: _errors,
	...props
}: React.ComponentProps<'div'> &
	({ children?: React.ReactNode; errors?: never } | { errors?: Error[]; children?: never })) {
	const content = useMemo((): ReactNode => {
		if (children) return children;

		// RHF Zod resolver places top level errors at the root of the error object.
		// eg. An array may have field validation errors (empty input) and a root error (too many items).
		const getMessage = (error: Error) =>
			(error && (error?.message || ('root' in error && error?.root?.message))) || null;

		// Ensure every error has a message
		const errors = _errors?.filter(v => !!getMessage(v));
		if (!errors || errors?.length === 0) return null;

		if (errors?.length === 1) return getMessage(errors[0]);

		return (
			<ul className='ml-4 flex list-disc flex-col gap-1'>
				{errors.map(error => getMessage(error) && <li>{getMessage(error)}</li>)}
			</ul>
		);
	}, [children, _errors]);

	if (!content) return null;

	return (
		<div
			role='alert'
			data-slot='field-error'
			className={cn('font-normal text-destructive text-sm', className)}
			{...props}
		>
			{content}
		</div>
	);
}

export {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldTitle,
};
