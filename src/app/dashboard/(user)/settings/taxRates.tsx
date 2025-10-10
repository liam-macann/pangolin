'use client';
import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';

import { DotsSixIcon, DotsThreeIcon, InfoIcon, TrashIcon } from '@phosphor-icons/react';

import { useRef } from 'react';
import { type Control, Controller, type UseFormReturn, useFieldArray } from 'react-hook-form';

import { v4 as uuid } from 'uuid';
import type { taxes } from '@/db/schema';
import { cn, type Prettify } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@/ui/field';
import { Input } from '@/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

type RateInput = Prettify<
	Omit<typeof taxes.$inferSelect, 'rate' | 'userId' | 'order'> & {
		/** Widened type to allow blank default value */
		rate: number | '';
		/** Flags whether the tax rate was pulled from the database. Used to reconcile deletions. */
		committed: boolean;
	}
>;

type FormValues = {
	taxes: RateInput[];
};

export function TaxRateField({
	className,
	form,
}: {
	className?: string;
	form: UseFormReturn<FormValues>;
}) {
	return (
		<FieldSet className={className}>
			<FieldContent className='ml-8'>
				<FieldLegend className='flex items-center gap-2'>
					Tax rates
					<Tooltip>
						<TooltipTrigger className='rounded-full'>
							<InfoIcon />
						</TooltipTrigger>
						<TooltipContent>
							Taxes defined here will always be printed on invoices, even if no tax is applicable.
						</TooltipContent>
					</Tooltip>
				</FieldLegend>
				<FieldDescription>
					When registered for tax, each rate can be applied on a per-item basis.
				</FieldDescription>
				<pre>{JSON.stringify(form.formState.errors.taxes?.root, null, 2)}</pre>

				{form.formState.errors.taxes?.root && (
					<FieldError className='text-xs' errors={[form.formState.errors.taxes?.root]} />
				)}
			</FieldContent>
			<TaxRateInput className='mt-2' form={form} />
		</FieldSet>
	);
}

export function TaxRateInput({
	className,
	form: { control, getValues },
}: {
	className?: string;
	form: UseFormReturn<FormValues>;
}) {
	const { fields, append, remove, move, update } = useFieldArray({ control, name: 'taxes' });
	const addTax = () => append({ id: uuid(), name: '', rate: '', deleted: false, committed: false });

	return (
		<FieldGroup className={cn('gap-2', className)}>
			{fields.reduce((acc, field) => (acc ? acc : !field.deleted), false) ? (
				<>
					<div className='grid grid-cols-[1.25rem_1fr_1fr_2.25rem] gap-3'>
						<div className='col-start-2'>
							<FieldLabel>Label</FieldLabel>
						</div>
						<div>
							<FieldLabel>
								Rate
								<Tooltip>
									<TooltipTrigger className='rounded-full'>
										<InfoIcon />
									</TooltipTrigger>
									<TooltipContent>
										Simple percentage of item total. Compound taxes are not supported.
									</TooltipContent>
								</Tooltip>
							</FieldLabel>
						</div>
					</div>
					<DragDropProvider
						onDragEnd={event => {
							const { operation, canceled } = event;
							const { source } = operation;

							if (canceled) return;

							if (isSortable(source)) {
								const initialIndex = source.sortable.initialIndex;
								const targetIndex = source.sortable.index;

								move(initialIndex, targetIndex);
							}
						}}
					>
						<ul className='flex flex-col gap-2'>
							{fields.map((tax, i) => (
								<Sortable
									control={control}
									key={tax.id}
									tax={tax}
									index={i}
									disabled={fields.reduce((acc, field) => (field.deleted ? acc : acc + 1), 0) < 2}
								>
									<DropdownMenuItem
										variant='destructive'
										onClick={() =>
											tax.committed
												? // RHF reduces rerenders. Update function may receive stale data without function call.
													update(i, { ...getValues(`taxes.${i}`), deleted: true })
												: remove(i)
										}
									>
										<TrashIcon />
										Delete
									</DropdownMenuItem>
								</Sortable>
							))}
						</ul>
					</DragDropProvider>
					<Button className='mt-3 self-end' onClick={addTax}>
						Add Tax
					</Button>
				</>
			) : (
				<div className='mb-7 ml-8 flex items-center justify-between gap-2 rounded-lg border border-dotted p-6 py-7'>
					<p className='font-medium text-muted-foreground text-sm'>No taxes configured</p>
					<Button onClick={addTax}>Add Tax</Button>
				</div>
			)}
		</FieldGroup>
	);
}

interface SortableProps {
	tax: RateInput;
	index: number;
	control: Control<FormValues>;
	children: React.ReactNode;
	disabled?: boolean;
}

function Sortable({ tax, index, control, children, disabled = false }: SortableProps) {
	const ref = useRef<HTMLLIElement>(null);

	const { isDragging, handleRef } = useSortable({
		id: tax.id,
		index,
		element: ref,
		disabled,
		modifiers: [
			RestrictToVerticalAxis,
			RestrictToElement.configure({ element: ref.current?.parentElement }),
		],
	});

	if (tax.deleted) return;

	return (
		<li
			ref={ref}
			className={cn(
				'relative grid origin-center grid-cols-[1.5rem_1fr_1fr_2.25rem] gap-2',
				'transition-all duration-200',
				isDragging && 'drop-shadow-black/7 drop-shadow-md',
			)}
		>
			<Button
				variant='link'
				className={cn('-ml-2.5 focus:!ring-0 group', disabled && 'cursor-not-allowed opacity-50')}
				size='icon'
				ref={handleRef}
			>
				<DotsSixIcon
					ref={handleRef}
					className={cn(
						'inline-block size-6 h-8 self-center',
						'rounded p-1 group-focus-visible:ring-2 group-focus-visible:ring-ring/50',
					)}
				/>
			</Button>
			<Controller
				control={control}
				disabled={tax.deleted}
				name={`taxes.${index}.name`}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid}>
						<Input
							type='text'
							className={cn(isDragging && 'border-ring/70', 'transition-colors')}
							placeholder='Label'
							{...field}
						/>
						{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
					</Field>
				)}
			/>
			<Controller
				control={control}
				name={`taxes.${index}.rate`}
				disabled={tax.deleted}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid}>
						<Input
							suffix='%'
							className={cn(isDragging && 'border-ring/70', 'transition-colors')}
							type='number'
							placeholder='2.5'
							onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
							{...field}
						/>
						{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
					</Field>
				)}
			/>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						size='icon'
						className={cn(isDragging && 'border-ring/70', 'bg-background')}
						variant='outline'
					>
						<DotsThreeIcon />
						<span className='sr-only'>Actions</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className='min-w-0' side='right'>
					{children}
				</DropdownMenuContent>
			</DropdownMenu>
		</li>
	);
}
