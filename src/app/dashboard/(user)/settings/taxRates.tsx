'use client';
import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { SortableContext } from '@dnd-kit/sortable';
import { DotsSixIcon, DotsThreeIcon, TrashIcon } from '@phosphor-icons/react';
import { createInsertSchema } from 'drizzle-zod';
import { useRef } from 'react';
import { type Control, Controller, type FieldValues, useFieldArray } from 'react-hook-form';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { InfoTip } from '@/components/info';
import { taxes } from '@/db/schema';
import { cn, type Prettify } from '@/lib/utils';
import { intlNumber } from '@/lib/zod';
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

export const taxArraySchema = z.array(
	createInsertSchema(taxes, {
		id: s => z.uuid().pipe(s),
		name: s =>
			z
				.string()
				.min(1, 'Please enter a tax label')
				.min(2, 'Label must be at least 2 characters')
				.pipe(s),
		rate: s =>
			intlNumber(
				z
					.number('Tax rate must be a number')
					.multipleOf(0.01, 'You may only define up to two decimal places')
					.min(0, 'Negative taxes are not allowed')
					.max(200, 'Tax may not exceed 200%'),
				'Please enter a quantity',
			).pipe(s),
	}),
);

type TaxField = Prettify<
	Pick<typeof taxes.$inferSelect, 'name' | 'id'> & {
		/** Widened type to allow blank default value */
		rate: number | '';
	}
>;

interface FormValues extends FieldValues {
	taxes: TaxField[];
}

export function TaxRateField<T extends FormValues>({
	className,
	control: _control,
}: {
	className?: string;
	control: Control<T>;
}) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<FormValues>;
	const state = control.getFieldState('taxes');

	return (
		<FieldSet className={className}>
			<FieldContent className='ml-8'>
				<FieldLegend className='flex items-center gap-2'>
					Tax rates
					<InfoTip side='right'>
						Taxes defined here will always be printed on invoices, even if no tax is applicable
					</InfoTip>
				</FieldLegend>
				<FieldDescription>
					When registered for tax, each rate can be applied on a per-item basis.
				</FieldDescription>
				{state.error?.root && <FieldError errors={[state.error?.root]} />}
			</FieldContent>
			<TaxRateInput className='mt-2' control={control} />
		</FieldSet>
	);
}

function TaxRateInput({
	className,
	control,
}: {
	className?: string;
	control: Control<FormValues>;
}) {
	const { fields, append, remove, move } = useFieldArray({ control, name: 'taxes' });
	const addTax = () => append({ id: uuid(), name: '', rate: '' });

	return (
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
			<SortableContext items={fields}>
				<FieldGroup className={cn('gap-2', className)}>
					{fields.length > 0 ? (
						<>
							<div className='grid grid-cols-[1.25rem_1fr_1fr_2.25rem] gap-3'>
								<div className='col-start-2'>
									<FieldLabel>Label</FieldLabel>
								</div>
								<div>
									<FieldLabel>
										Rate
										<InfoTip>
											Simple percentage of item total. Compound taxes are not supported.
										</InfoTip>
									</FieldLabel>
								</div>
							</div>
							<ul className='flex flex-col gap-2'>
								{fields.map((tax, i) => (
									<Sortable
										control={control}
										key={tax.id}
										tax={tax}
										index={i}
										disabled={fields.length < 2}
									>
										<DropdownMenuItem variant='destructive' onClick={() => remove(i)}>
											<TrashIcon />
											Delete
										</DropdownMenuItem>
									</Sortable>
								))}
							</ul>
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
			</SortableContext>
		</DragDropProvider>
	);
}

interface SortableProps {
	tax: TaxField;
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
				className={cn(
					'-ml-2.5 focus:!ring-0 group touch-manipulation',
					disabled && 'cursor-not-allowed opacity-50',
				)}
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
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid}>
						<Input
							suffix='%'
							className={cn(isDragging && 'border-ring/70', 'transition-colors')}
							type='text'
							inputMode='decimal'
							placeholder='2.5'
							step='any'
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
