'use client';

import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { SortableContext } from '@dnd-kit/sortable';
import { DotsSixIcon, DotsThreeIcon } from '@phosphor-icons/react';
import { createInsertSchema } from 'drizzle-zod';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import {
	type Control,
	Controller,
	type FieldArrayWithId,
	type FieldValues,
	type UseFormGetValues,
	useFieldArray,
	useFormState,
	useWatch,
} from 'react-hook-form';
import { z } from 'zod';
import { invoiceItems, unitEnum } from '@/db/schema';
import type { getUserConfig } from '@/lib/data';
import { cn, formatCurrency, getCurrencySymbol, type Prettify } from '@/lib/utils';
import { intlNumber } from '@/lib/zod';

import { Button } from '@/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/ui/field';
import { Input } from '@/ui/input';
import {
	Select,
	SelectClear,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@/ui/select';

export const itemsArraySchema = z
	.array(
		createInsertSchema(invoiceItems, {
			label: z => z.min(1, 'Please enter a description'),
			quantity: s =>
				intlNumber(
					z.number().min(0, 'Enter a valid quantity').max(10000, 'Too large'),
					'Enter quantity',
				).pipe(s),
			unitCost: s =>
				intlNumber(
					z.number('Enter a valid cost').min(-1000000, 'Too small').max(1000000, 'Too large'),
					'Enter cost',
				).pipe(s),
		})
			.pick({
				label: true,
				note: true,
				quantity: true,
				unit: true,
				unitCost: true,
			})
			.extend({
				taxes: z.map(z.uuid('Invalid tax: check configuration'), z.boolean()),
			}),
	)
	.min(1, 'Invoice must contain items');

type ItemField = z.infer<typeof itemsArraySchema>;

interface FormValues extends FieldValues {
	items: ItemField;
}

type Config = Pick<
	Awaited<ReturnType<typeof getUserConfig>>,
	'currency' | 'locale' | 'tax' | 'taxRegistration'
>;

export function InvoiceItemsField<T extends FormValues>({
	className,
	control: _control,
	getValues: _getValues,
	config,
}: {
	className?: string;
	control: Control<T>;
	getValues: UseFormGetValues<T>;
	config: Config;
}) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<FormValues>;
	const getValues = _getValues as unknown as UseFormGetValues<FormValues>;

	return (
		<FieldSet className={cn('gap-0', className)}>
			<FieldLegend className='sr-only'>Items</FieldLegend>
			<InvoiceItemsInput config={config} control={control} getValues={getValues} />
		</FieldSet>
	);
}

function ItemSum({
	control,
	config,
	className,
}: {
	control: Control<FormValues>;
	config: Config;
	className?: string;
}) {
	const value = useWatch({ name: 'items', control });

	const subtotal = value.reduce((acc, item) => acc + item.unitCost * item.quantity, 0);

	const taxes = new Map(config.tax.map(tax => [tax.id, tax]));
	const taxesSum = new Map<string, number>();

	value.forEach(item => {
		item.taxes.forEach((state, id) => {
			const t = taxes.get(id);
			if (state && t)
				taxesSum.set(id, (taxesSum.get(id) || 0) + t.rate * item.unitCost * item.quantity);
		});
	});

	return (
		<table className={cn('block max-w-full table-auto text-sm', className)}>
			<tbody className='contents'>
				<tr className='flex items-baseline justify-between gap-4 text-muted-foreground *:pb-1.5'>
					<td>Subtotal</td>
					<td className='truncate text-right tabular-nums'>
						{formatCurrency(subtotal, config.currency, config.locale)}
					</td>
				</tr>
				{/*{Array.from(taxes).map(([id, tax]) => (
  				<tr key={id} className='flex items-baseline justify-between gap-4 text-muted-foreground *:py-0.5 last-of-type:*:pb-1'>
  					<td>{tax.name}</td>
  					<td className='text-right tabular-nums'>
  						{formatCurrency(taxesSum.get(id) || 0, config.currency, config.locale)}
  					</td>
  				</tr>
  			))}*/}
			</tbody>
			<tfoot className='contents'>
				<tr className='flex items-baseline justify-between gap-4 border-t font-semibold *:pt-1'>
					<td>Total</td>
					<td className='truncate text-right text-lg tabular-nums'>
						{formatCurrency(
							Array.from(taxesSum.values()).reduce((acc, tax) => acc + tax, 0) + subtotal,
							config.currency,
							config.locale,
						)}
					</td>
				</tr>
			</tfoot>
		</table>
	);
}

function InvoiceItemsInput({
	className,
	control,
	getValues,
	config,
}: {
	className?: string;
	control: Control<FormValues>;
	getValues: UseFormGetValues<FormValues>;
	config: Config;
}) {
	const { fields, append, remove, move, insert } = useFieldArray({ control, name: 'items' });
	const addItem = () =>
		append({
			label: '',
			note: '',
			quantity: '' as unknown as number, // Input condition satisfied, and we want to init empty values
			unit: null,
			unitCost: '' as unknown as number, // Input condition satisfied, and we want to init empty values
			taxes: new Map(config.tax.map(tax => [tax.id, config.taxRegistration])),
		});

	const {
		errors: { items: errors },
	} = useFormState({ control, name: 'items' });

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
				<FieldGroup className={cn('gap-0', className)}>
					{fields.length > 0 ? (
						<>
							<div className='grid grid-cols-[1.25rem_2fr_1.1fr_1fr_2.25rem] gap-2'>
								<div className='col-start-2'>
									<FieldLabel>Description</FieldLabel>
								</div>
								<FieldLabel>Quantity</FieldLabel>
								<FieldLabel>Each</FieldLabel>
							</div>
							<ul className='flex flex-col'>
								<AnimatePresence>
									{fields.map((item, i) => (
										<Sortable
											control={control}
											getValues={getValues}
											key={item.id}
											item={item}
											index={i}
											disabled={fields.length < 2}
											config={config}
										>
											<DropdownMenuItem onClick={() => insert(i + 1, getValues(`items.${i}`))}>
												Duplicate
											</DropdownMenuItem>
											<DropdownMenuItem variant='destructive' onClick={() => remove(i)}>
												Delete
											</DropdownMenuItem>
										</Sortable>
									))}
								</AnimatePresence>
							</ul>

							{errors && <FieldError className='mt-3 ml-7' errors={[errors]} />}

							<div className='mt-6 ml-7 flex justify-between gap-8'>
								<Button onClick={addItem} size='sm'>
									Add Item
								</Button>
								<ItemSum control={control} config={config} className='min-w-48 self-end' />
							</div>
						</>
					) : (
						<div className='flex items-center justify-between gap-2 rounded-lg border border-dotted p-6 max-sm:flex-col'>
							<div className='flex flex-col gap-1'>
								<p className='font-medium text-muted-foreground text-sm'>Add an invoice item</p>
								{errors && <FieldError className='' errors={[errors]} />}
							</div>
							<Button onClick={addItem}>Add Item</Button>
						</div>
					)}
				</FieldGroup>
			</SortableContext>
		</DragDropProvider>
	);
}

interface SortableProps {
	item: Prettify<FieldArrayWithId<FormValues, 'items', 'id'>>;
	index: number;
	control: Control<FormValues>;
	getValues: UseFormGetValues<FormValues>;
	children: React.ReactNode;
	disabled?: boolean;
	config: Config;
}

function Sortable({
	item,
	index,
	control,
	disabled = false,
	config,
	getValues,
	children,
}: SortableProps) {
	const ref = useRef<HTMLLIElement>(null);

	const { isDragging, handleRef } = useSortable({
		id: item.id,
		index,
		element: ref,
		disabled,
		modifiers: [
			RestrictToVerticalAxis,
			RestrictToElement.configure({ element: ref.current?.parentElement }),
		],
	});

	return (
		<motion.li
			ref={ref}
			className={cn('bg-background', 'group/sortable')}
			initial={{ height: 0, opacity: 0, pointerEvents: 'none' }}
			animate={{ height: 'auto', scale: 1, opacity: 1, pointerEvents: 'auto' }}
			exit={{ height: 0, opacity: 0, pointerEvents: 'none' }}
			transition={{ duration: 0.1, ease: 'easeOut' }}
			key={item.id}
		>
			<motion.div
				className={cn(
					'relative grid origin-top grid-cols-[1.25rem_2fr_1.1fr_1fr_2.25rem] gap-2 border-border border-y border-t-transparent border-dotted py-3 *:transition-[filter]',
					isDragging && '*:drop-shadow-black/7 *:drop-shadow-md',
					'group-not-first/sortable:group-[[style*="--dnd-translate"]]/sortable:group-not-[[style*="--dnd-translate:_0px_0px_0"]]/sortable:border-t-border',
				)}
				initial={{
					opacity: 0,
					scale: 0.98,
					filter: 'blur(4px)',
				}}
				animate={{
					opacity: 1,
					scale: 1,
					filter: 'blur(0px)',
				}}
				exit={{
					opacity: 0,
					scale: 0.98,
					filter: 'blur(4px)',
				}}
				transition={{ duration: 0.08, ease: 'easeOut' }}
			>
				<Button
					variant='link'
					className={cn('-ml-2.5 focus:!ring-0 group touch-manipulation')}
					size='icon'
					disabled={disabled}
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
					name={`items.${index}.label`}
					render={({ field, fieldState }) => (
						<Field className='gap-0.5' data-invalid={fieldState.invalid}>
							<Input
								type='text'
								className={cn(isDragging && 'border-ring/70', 'transition-colors')}
								placeholder='Description'
								{...field}
							/>
							{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
						</Field>
					)}
				/>
				<Controller
					control={control}
					name={`items.${index}.quantity`}
					render={({ field, fieldState }) => (
						<Field className='gap-0.5' data-invalid={fieldState.invalid}>
							<Input
								className={cn(isDragging && 'border-ring/70', 'transition-colors')}
								type='number'
								min={0}
								inputMode='decimal'
								placeholder='2'
								onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
								{...field}
								suffix={
									<Controller
										control={control}
										name={`items.${index}.units`}
										render={({ field }) => (
											<Select {...field} onValueChange={field.onChange} required={false}>
												<SelectTrigger asChild>
													<Button
														size='xs'
														variant='secondary'
														className='-mr-1.5 data-placeholder:text-muted-foreground'
													>
														<SelectValue placeholder='units' />
													</Button>
												</SelectTrigger>
												<SelectContent>
													<SelectGroup>
														<SelectLabel>Units</SelectLabel>
														<SelectClear />
														{unitEnum.enumValues.map(unit => (
															<SelectItem key={unit} value={unit}>
																{unit}
															</SelectItem>
														))}
													</SelectGroup>
												</SelectContent>
											</Select>
										)}
									/>
								}
							/>
							{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
						</Field>
					)}
				/>
				<Controller
					control={control}
					name={`items.${index}.unitCost`}
					render={({ field, fieldState }) => (
						<Field className='gap-0.5' data-invalid={fieldState.invalid}>
							<Input
								className={cn(isDragging && 'border-ring/70', 'transition-colors')}
								type='number'
								inputMode='decimal'
								placeholder='40'
								onKeyDown={e => ['e', 'E', '+'].includes(e.key) && e.preventDefault()}
								prefix={getCurrencySymbol(config.currency, config.locale)}
								{...field}
							/>
							{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
						</Field>
					)}
				/>
				<SortableActions
					className={cn(isDragging && 'border-ring/70')}
					getValues={getValues}
					config={config}
					control={control}
					index={index}
				>
					{children}
				</SortableActions>
			</motion.div>
		</motion.li>
	);
}

// Isolate re-render due to field watch
function SortableActions({
	className,
	index,
	control,
	config,
	getValues,
	children,
}: { className?: string } & Pick<
	SortableProps,
	'index' | 'control' | 'config' | 'getValues' | 'children'
>) {
	// Not ideal, but useWatch causes stale conflict issues with AnimatePresence. This keeps state updated onChange.
	const [activeTaxes, setActiveTaxes] = useState(
		getValues(`items.${index}.taxes`)
			.values()
			.reduce((acc, value) => acc + Number(value), 0),
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size='icon' className={cn('relative bg-background', className)} variant='outline'>
					<DotsThreeIcon />
					<span className='sr-only'>Actions</span>
					{config.taxRegistration && (
						<div className='-translate-y-1/2 absolute top-0 right-0 flex h-4.5 min-w-4.5 translate-x-1/2 items-center justify-center rounded-full border bg-background px-1 text-muted-foreground text-xs'>
							{activeTaxes}
						</div>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side='right' sideOffset={12}>
				{config.taxRegistration && config.tax.length > 0 && (
					<>
						<DropdownMenuLabel>Taxes</DropdownMenuLabel>
						<Controller
							control={control}
							name={`items.${index}.taxes`}
							render={({ field, fieldState }) => (
								<DropdownMenuGroup>
									{config.tax.map(tax => {
										return (
											<DropdownMenuCheckboxItem
												key={tax.id}
												checkbox
												disabled={!config.taxRegistration}
												checked={field.value.get(tax.id)}
												onSelect={e => e.preventDefault()}
												onCheckedChange={val => {
													const update = new Map(getValues(`items.${index}.taxes`));
													update.set(tax.id, val);
													field.onChange(update);

													setActiveTaxes(
														getValues(`items.${index}.taxes`)
															.values()
															.reduce((acc, value) => acc + Number(value), 0),
													);
												}}
												className='justify-between'
											>
												{tax.name}
												<span className='text-muted-foreground'>{tax.rate * 100}%</span>
											</DropdownMenuCheckboxItem>
										);
									})}
									{fieldState.invalid && (
										<FieldError className='text-xs' errors={[fieldState.error]} />
									)}
								</DropdownMenuGroup>
							)}
						/>

						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuLabel>Actions</DropdownMenuLabel>
				<DropdownMenuGroup>{children}</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
