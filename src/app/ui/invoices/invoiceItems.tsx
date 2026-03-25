'use client';

import { DotsThreeIcon } from '@phosphor-icons/react';
import { useState } from 'react';
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
import { type z } from 'zod';

import { type getUserConfig } from '@/lib/data';
import { cn, formatCurrency, getCurrencySymbol, type Prettify } from '@/lib/utils';
import { type invoice as schema } from '@/lib/validation/invoice';
import { intlNumber } from '@/lib/zod';
import { unitEnum } from '@/db/schema';

import {
	Sortable,
	SortableEmpty,
	SortableHandle,
	SortableItem,
	SortableList,
} from '@/components/sortable-input';
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
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/ui/field';
import { Input } from '@/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ui/input-group';
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

interface FormValues extends FieldValues {
	items: z.input<typeof schema.shape.items>;
}

type Config = Pick<
	Awaited<ReturnType<typeof getUserConfig>>,
	'currency' | 'locale' | 'taxes' | 'taxRegistration'
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
	const items = useWatch({ name: 'items', control });

	/** Records all taxes valid in current configuration */
	const taxes = new Map(config.taxes.map(tax => [tax.id, tax]));

	/** Records the total tax amount for each tax id */
	const taxesSum = new Map<string, number>();

	const subtotal = items.reduce((acc, item) => {
		try {
			// Use same coercion logic as form validation
			const unitCost = intlNumber().parse(item.unitCost);
			const quantity = intlNumber().parse(item.quantity);

			// Side effect: increment taxesSum to prevent second loop pass
			[...item.taxes].forEach(id => {
				const tax = taxes.get(id);
				if (tax) taxesSum.set(id, (taxesSum.get(id) || 0) + tax.rate * unitCost * quantity);
			});

			return acc + unitCost * quantity;
		} catch {
			// Ignore errors (eg. NaN) during live total
			return acc;
		}
	}, 0);

	return (
		<table className={cn('block w-0 min-w-0 max-w-min shrink grow table-auto text-sm', className)}>
			<tbody className='contents'>
				<tr className='flex items-baseline justify-between gap-4 text-muted-foreground *:pb-1.5'>
					<td>Subtotal</td>
					<td className='truncate text-right tabular-nums'>
						{formatCurrency(subtotal, config.currency, config.locale)}
					</td>
				</tr>
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
	control,
	getValues,
	config,
}: {
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
			taxes: config.taxRegistration ? new Set(config.taxes.map(tax => tax.id)) : new Set(),
		});

	const {
		errors: { items: errors },
	} = useFormState({ control, name: 'items' });

	return (
		<Sortable items={fields} onReorder={({ initialIndex, index }) => move(initialIndex, index)}>
			<div className='grid grid-cols-[1rem_2fr_1.1fr_1fr_2.25rem] gap-2 group-data-[empty]/sortable:hidden'>
				<div className='col-start-2'>
					<FieldLabel>Description</FieldLabel>
				</div>
				<FieldLabel>Quantity</FieldLabel>
				<FieldLabel>Each</FieldLabel>
			</div>
			<SortableList>
				{(item, i) => (
					<SortableItem
						index={i}
						key={item.id}
						id={item.id}
						className={cn(
							'grid grid-cols-[1rem_2fr_1.1fr_1fr_2.25rem] py-3',
							'border-border border-y border-t-transparent border-dotted',
							'group-not-first/sortable-item:group-[[style*="--dnd-translate"]]/sortable-item:group-not-[[style*="--dnd-translate:_0px_0px_0"]]/sortable-item:border-t-border',
						)}
					>
						<SortableHandle className='-translate-x-1' />

						{/* Occlude tax badge on drag overlap */}
						<div className='pointer-events-none absolute inset-0 -inset-x-3 -z-10 bg-background drop-shadow-none dark:bg-popover' />

						<Controller
							control={control}
							name={`items.${i}.label`}
							render={({ field, fieldState }) => (
								<Field className='gap-0.5' data-invalid={fieldState.invalid}>
									<Input type='text' placeholder='Description' {...field} />
									{fieldState.invalid && (
										<FieldError className='text-xs' errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
						<Controller
							control={control}
							name={`items.${i}.quantity`}
							render={({ field, fieldState }) => (
								<Field className='gap-0.5' data-invalid={fieldState.invalid}>
									<InputGroup>
										<InputGroupInput
											type='number'
											min={0}
											inputMode='decimal'
											placeholder='2'
											onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
											{...field}
										/>

										<InputGroupAddon align='inline-end'>
											<Controller
												control={control}
												name={`items.${i}.unit`}
												render={({ field }) => (
													<Select {...field} onValueChange={field.onChange} required={false}>
														<SelectTrigger
															size='xs'
															render={
																<InputGroupButton
																	size='xs'
																	variant='secondary'
																	className='data-placeholder:text-muted-foreground'
																>
																	<SelectValue placeholder='units' />
																</InputGroupButton>
															}
														/>

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
										</InputGroupAddon>
									</InputGroup>
									{fieldState.invalid && (
										<FieldError className='text-xs' errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
						<Controller
							control={control}
							name={`items.${i}.unitCost`}
							render={({ field, fieldState }) => (
								<Field className='gap-0.5' data-invalid={fieldState.invalid}>
									<InputGroup>
										<InputGroupInput
											type='number'
											inputMode='decimal'
											placeholder='40'
											onKeyDown={e => ['e', 'E', '+'].includes(e.key) && e.preventDefault()}
											{...field}
										/>
										<InputGroupAddon className='font-normal' align='inline-start'>
											{getCurrencySymbol(config.currency, config.locale)}
										</InputGroupAddon>
									</InputGroup>
									{fieldState.invalid && (
										<FieldError className='text-xs' errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>

						<SortableActions getValues={getValues} config={config} control={control} index={i}>
							<DropdownMenuItem onClick={() => insert(i + 1, getValues(`items.${i}`))}>
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuItem variant='destructive' onClick={() => remove(i)}>
								Delete
							</DropdownMenuItem>
						</SortableActions>
					</SortableItem>
				)}
			</SortableList>

			<div className='relative mt-6 ml-(--sortable-handle-width) flex justify-between gap-8 group-data-[empty]/sortable:hidden'>
				<Button onClick={addItem} className='ml-6' size='sm'>
					Add Item
				</Button>
				<ItemSum control={control} config={config} className='min-w-48 self-end' />
			</div>

			{errors && (
				<FieldError className='mt-3 ml-7 group-data-[empty]/sortable:hidden' errors={[errors]} />
			)}

			<SortableEmpty className='flex items-center justify-between gap-2 rounded-lg border border-dotted p-6 max-sm:flex-col'>
				<div className='flex flex-col gap-1'>
					<p className='font-medium text-muted-foreground text-sm'>Add an invoice item</p>
					{errors && <FieldError className='' errors={[errors]} />}
				</div>
				<Button onClick={addItem}>Add Item</Button>
			</SortableEmpty>
		</Sortable>
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
	const [activeTaxes, setActiveTaxes] = useState(getValues(`items.${index}.taxes`).size);

	const state = useFormState({ control, name: `items.${index}.taxes` });
	const itemErrors = state.errors.items?.[index];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						size='icon'
						className={cn(
							'relative bg-background',
							itemErrors?.taxes && 'border-destructive/40',
							className,
						)}
						variant='outline'
					>
						<DotsThreeIcon />
						<span className='sr-only'>Actions</span>
						{config.taxRegistration && (
							<div
								className={cn(
									'absolute top-0 right-0 flex h-4.5 min-w-4.5 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background px-1 text-muted-foreground text-xs',
									itemErrors?.taxes && 'border-black/20 bg-destructive-background text-white',
								)}
							>
								{activeTaxes}
							</div>
						)}
					</Button>
				}
			/>
			<DropdownMenuContent side='right' sideOffset={12}>
				{config.taxRegistration && config.taxes.length > 0 && (
					<>
						<DropdownMenuGroup>
							<DropdownMenuLabel>Taxes</DropdownMenuLabel>
							<Controller
								control={control}
								name={`items.${index}.taxes`}
								render={({ field, fieldState }) => (
									<>
										{config.taxes.map(tax => {
											return (
												<DropdownMenuCheckboxItem
													key={tax.id}
													checkbox
													disabled={!config.taxRegistration}
													checked={field.value.has(tax.id)}
													onSelect={e => e.preventDefault()}
													onCheckedChange={val => {
														const update = new Set(getValues(`items.${index}.taxes`));

														if (val) update.add(tax.id);
														else update.delete(tax.id);

														field.onChange(update);

														setActiveTaxes(update.size);
													}}
													className='justify-between'
												>
													{tax.name}
													<span className='text-muted-foreground'>{tax.rate * 100}%</span>
												</DropdownMenuCheckboxItem>
											);
										})}
										{fieldState.invalid && (
											<FieldError
												className='mx-1 my-1.5 mr-2 text-xs'
												errors={Object.values(
													fieldState.error as Record<string, { message?: string }>,
												)}
											/>
										)}
									</>
								)}
							/>
						</DropdownMenuGroup>

						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuGroup>
					<DropdownMenuLabel className='first:hidden'>Actions</DropdownMenuLabel>
					{children}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
