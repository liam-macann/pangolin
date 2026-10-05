import { DotsThreeIcon } from '@phosphor-icons/react';
import { type ComponentProps, type ReactNode } from 'react';
import { type Control, Controller, useFormState, useWatch } from 'react-hook-form';

import { cn, rateToPercent } from '@/lib/utils';
import { getCurrencySymbol } from '@/lib/utils/currencies';
import { unitEnum } from '@/db/schema';

import { SortableHandle, SortableItem } from '@/components/sortable';
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
import { Field, FieldError } from '@/ui/field';
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

import { type LineItemsConfig, type LineItemsFormValues } from './types';

/** CSS grid column template for line item rows */
export const gridColumns = 'grid-cols-[1rem_2fr_1.1fr_1fr_2.25rem]';

function UnitSelect(props: ComponentProps<typeof Select>) {
	return (
		<Select required={false} {...props}>
			<SelectTrigger
				aria-label='Unit'
				size='xs'
				className='data-placeholder:text-muted-foreground'
				render={
					<InputGroupButton variant='secondary'>
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
	);
}

export function LineItemRow({
	itemId,
	index,
	control,
	config,
	onDuplicate,
	onDelete,
}: {
	itemId: string;
	index: number;
	control: Control<LineItemsFormValues>;
	config: LineItemsConfig;
	onDuplicate: () => void;
	onDelete: () => void;
}) {
	return (
		<SortableItem
			index={index}
			id={itemId}
			className={cn(
				'grid py-2',
				gridColumns,
				'border-border border-y border-t-transparent border-dotted',
				'group-not-first/sortable-item:group-[[style*="--dnd-translate"]]/sortable-item:group-not-[[style*="--dnd-translate:_0px_0px_0"]]/sortable-item:border-t-border',
			)}
		>
			<SortableHandle className='-translate-x-1' />

			{/* Outdented to occlude tax badge on drag overlap */}
			<div className='pointer-events-none absolute inset-0 -inset-x-3 -z-10 bg-background drop-shadow-none' />

			<Controller
				control={control}
				name={`items.${index}.label`}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid}>
						<Input aria-label='Description' type='text' placeholder='Description' {...field} />
						{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
					</Field>
				)}
			/>
			<Controller
				control={control}
				name={`items.${index}.quantity`}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid}>
						<InputGroup>
							<InputGroupInput
								aria-label='Quantity'
								type='text'
								inputMode='decimal'
								placeholder='2'
								pattern='[0-9.,]+'
								{...field}
								onChange={event => {
									const value = event.target.value.replace(/[^0-9.,]/g, '');
									field.onChange(value);
								}}
							/>

							<InputGroupAddon align='inline-end'>
								<Controller
									control={control}
									name={`items.${index}.unit`}
									render={({ field }) => <UnitSelect {...field} onValueChange={field.onChange} />}
								/>
							</InputGroupAddon>
						</InputGroup>
						{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
					</Field>
				)}
			/>
			<Controller
				control={control}
				name={`items.${index}.unitCost`}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid}>
						<InputGroup>
							<InputGroupInput
								aria-label='Each'
								type='text'
								inputMode='decimal'
								placeholder='40'
								pattern='[\-]?[0-9.,]+'
								{...field}
								onChange={event => {
									const value = event.target.value
										.replace(/[^0-9.,-]/g, '')
										.replace(/(?!^)[-]/g, '');
									field.onChange(value);
								}}
							/>
							<InputGroupAddon className='font-normal' align='inline-start'>
								{getCurrencySymbol(config.currency, config.locale)}
							</InputGroupAddon>
						</InputGroup>
						{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
					</Field>
				)}
			/>

			<LineItemActions config={config} control={control} index={index}>
				<DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
				<DropdownMenuItem variant='destructive' onClick={onDelete}>
					Delete
				</DropdownMenuItem>
			</LineItemActions>
		</SortableItem>
	);
}

// Isolate re-render due to field watch
function LineItemActions({
	className,
	index,
	control,
	config,
	children,
}: {
	className?: string;
	index: number;
	control: Control<LineItemsFormValues>;
	config: LineItemsConfig;
	children: ReactNode;
}) {
	const activeTaxes = useWatch({ control, name: `items.${index}.taxes` })?.size ?? 0;

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
			<DropdownMenuContent side='right' sideOffset={8}>
				{config.taxRegistration && config.taxes.length > 0 && (
					<>
						<DropdownMenuGroup>
							<DropdownMenuLabel>Taxes</DropdownMenuLabel>
							<Controller
								control={control}
								name={`items.${index}.taxes`}
								render={({ field, fieldState }) => (
									<>
										{config.taxes.map(tax => (
											<DropdownMenuCheckboxItem
												key={tax.id}
												checkbox
												checked={field.value.has(tax.id)}
												onSelect={event => event.preventDefault()}
												onCheckedChange={checked => {
													const updatedTaxes = new Set(field.value);

													if (checked) updatedTaxes.add(tax.id);
													else updatedTaxes.delete(tax.id);

													field.onChange(updatedTaxes);
												}}
												className='justify-between'
											>
												{tax.name}
												<span className='text-muted-foreground'>{rateToPercent(tax.rate)}%</span>
											</DropdownMenuCheckboxItem>
										))}
										{fieldState.invalid && (
											<FieldError
												className='mx-1 my-1.5 mr-2 text-xs'
												errors={getErrorMessages(fieldState.error)}
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

function getErrorMessages(error: unknown): { message: string }[] {
	if (typeof error !== 'object' || error === null) return [];
	if ('message' in error && typeof error.message === 'string') return [{ message: error.message }];
	return Object.values(error).flatMap(getErrorMessages);
}
