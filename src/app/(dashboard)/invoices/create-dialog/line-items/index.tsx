'use client';

import { type Control, type UseFormGetValues, useFieldArray, useFormState } from 'react-hook-form';

import { cn } from '@/lib/utils';

import { Sortable, SortableEmpty, SortableList } from '@/components/sortable';
import { Button } from '@/ui/button';
import { EmptyDescription } from '@/ui/empty';
import { FieldError, FieldLabel, FieldLegend, FieldSet } from '@/ui/field';

import { gridColumns, LineItemRow } from './item-row';
import { InvoiceTotals } from './totals';
import { type LineItemsConfig, type LineItemsFormValues } from './types';

function createLineItem(config: LineItemsConfig): LineItemsFormValues['items'][number] {
	return {
		label: '',
		note: '',
		quantity: '',
		unit: null,
		unitCost: '',
		taxes: new Set(config.taxRegistration ? config.taxes.map(tax => tax.id) : []),
	};
}

export function LineItemsField<T extends LineItemsFormValues>({
	className,
	control: _control,
	getValues: _getValues,
	config,
}: {
	className?: string;
	control: Control<T>;
	getValues: UseFormGetValues<T>;
	config: LineItemsConfig;
}) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<LineItemsFormValues>;
	const getValues = _getValues as unknown as UseFormGetValues<LineItemsFormValues>;

	return (
		<FieldSet className={cn('gap-0', className)}>
			<FieldLegend className='sr-only'>Items</FieldLegend>
			<LineItemsInput config={config} control={control} getValues={getValues} />
		</FieldSet>
	);
}

function LineItemsInput({
	control,
	getValues,
	config,
}: {
	control: Control<LineItemsFormValues>;
	getValues: UseFormGetValues<LineItemsFormValues>;
	config: LineItemsConfig;
}) {
	const { fields, append, remove, move, insert } = useFieldArray({ control, name: 'items' });
	const addItem = () => append(createLineItem(config));

	const {
		errors: { items: errors },
	} = useFormState({ control, name: 'items' });

	return (
		<Sortable
			items={fields}
			onReorder={({ initialIndex, index }) => move(initialIndex, index)}
			className='gap-1'
		>
			<div className={cn('grid gap-2 group-data-empty/sortable:hidden', gridColumns)}>
				<div className='col-start-2'>
					<FieldLabel>Description</FieldLabel>
				</div>
				<FieldLabel>Quantity</FieldLabel>
				<FieldLabel>Each</FieldLabel>
			</div>
			<SortableList>
				{(item, index) => (
					<LineItemRow
						key={item.id}
						itemId={item.id}
						index={index}
						control={control}
						config={config}
						onDuplicate={() => insert(index + 1, getValues(`items.${index}`))}
						onDelete={() => remove(index)}
					/>
				)}
			</SortableList>

			<div className='relative mt-6 ml-(--sortable-handle-width) flex justify-between gap-8 group-data-empty/sortable:hidden'>
				<Button onClick={addItem} className='ml-6' size='sm'>
					Add Item
				</Button>
				<InvoiceTotals control={control} config={config} className='min-w-48 self-end' />
			</div>

			{errors && (
				<FieldError className='mt-3 ml-7 group-data-empty/sortable:hidden' errors={[errors]} />
			)}

			<SortableEmpty>
				<div className='flex flex-col'>
					<EmptyDescription className='text-left font-medium'>Add an invoice item</EmptyDescription>
					<FieldError errors={[errors]} />
				</div>
				<Button onClick={addItem}>Add Item</Button>
			</SortableEmpty>
		</Sortable>
	);
}
