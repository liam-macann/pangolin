'use client';
import { TrashIcon } from '@phosphor-icons/react';
import { matchSorter } from 'match-sorter';
import { useState } from 'react';
import { type Control, Controller, type FieldValues, useFieldArray } from 'react-hook-form';
import type { z } from 'zod';
import {
	Sortable,
	SortableActions,
	SortableEmpty,
	SortableItem,
	SortableList,
} from '@/components/sortable-input';
import type { config as configSchema } from '@/lib/validation/config';
import {
	Autocomplete,
	AutocompleteEmpty,
	AutocompleteInput,
	AutocompleteItem,
	AutocompleteList,
	AutocompletePopup,
	AutocompletePositioner,
} from '@/ui/autocomplete';
import { Button } from '@/ui/button';
import { DropdownMenuItem } from '@/ui/dropdown-menu';
import { Field, FieldError, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';

interface FormValues extends FieldValues {
	paymentDetails: z.infer<typeof configSchema.shape.paymentDetails>;
}

export function PaymentDetailsField<T extends FormValues>({
	control: _control,
	className,
}: {
	control: Control<T>;
	className?: string;
}) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<FormValues>;

	const { fields, append, remove, move } = useFieldArray({ control, name: 'paymentDetails' });
	const addLine = () => append({ label: '', value: '' });

	return (
		<Sortable
			className={className}
			items={fields}
			onReorder={({ initialIndex, index }) => move(initialIndex, index)}
		>
			<SortableEmpty className='flex items-center justify-between gap-2 rounded-lg border border-dotted p-6 py-7'>
				<p className='font-medium text-muted-foreground text-sm'>No payment details provided</p>
				<Button onClick={addLine}>Add Details</Button>
			</SortableEmpty>

			<div className='grid grid-cols-[1.5rem_1fr_2fr_2.25rem] gap-2 group-data-[empty]/sortable:hidden'>
				<FieldLabel className='col-start-2'>Label</FieldLabel>
				<FieldLabel>Value</FieldLabel>
			</div>
			<SortableList>
				{(item, i) => (
					<Item key={item.id} id={item.id} index={i} control={control}>
						<DropdownMenuItem variant='destructive' onClick={() => remove(i)}>
							<TrashIcon />
							Delete
						</DropdownMenuItem>
					</Item>
				)}
			</SortableList>

			<div className='mt-2 flex justify-between gap-2 self-end group-data-[empty]/sortable:hidden'>
				<Button size='sm' onClick={() => remove()} variant='secondary'>
					Clear
				</Button>
				<Button size='sm' onClick={addLine}>
					Add Detail
				</Button>
			</div>
		</Sortable>
	);
}

function Item({
	control,
	id,
	index,
	children,
}: {
	control: Control<FormValues>;
	id: string;
	index: number;
	children: React.ReactNode;
}) {
	/** The ID of the selected label, if autocompleted. Used to provide placeholder for value */
	const [scheme, setScheme] = useState<string | null>(null);

	return (
		<SortableItem id={id} index={index} className='grid grid-cols-[1.5rem_1fr_2fr_2.25rem]'>
			<Controller
				control={control}
				name={`paymentDetails.${index}.label`}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid}>
						<Autocomplete
							limit={6}
							items={labels}
							filter={fuzzyFilter}
							itemToStringValue={item => item.value}
							onValueChange={item => field.onChange(item)}
						>
							<AutocompleteInput
								onInput={() => setScheme(null)}
								placeholder='eg. IBAN'
								{...field}
							/>
							<AutocompletePositioner sideOffset={6}>
								<AutocompletePopup className='data-empty:hidden'>
									<AutocompleteEmpty>No matches found.</AutocompleteEmpty>
									<AutocompleteList>
										{(label: Label) => (
											<AutocompleteItem
												className='flex justify-between'
												key={label.id}
												value={label}
												onClick={() => setScheme(label.placeholder || null)}
											>
												{label.value}
												<span className='text-muted-foreground text-xs'>{label.region}</span>
											</AutocompleteItem>
										)}
									</AutocompleteList>
								</AutocompletePopup>
							</AutocompletePositioner>
						</Autocomplete>
						{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
					</Field>
				)}
			/>
			<Controller
				control={control}
				name={`paymentDetails.${index}.value`}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid}>
						<Input
							type='text'
							{...field}
							className='tabular-nums'
							placeholder={scheme || undefined}
						/>
						{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
					</Field>
				)}
			/>
			<SortableActions align='center'>{children}</SortableActions>
		</SortableItem>
	);
}

interface Label {
	id: string;
	value: string;
	region: string;
	fuzzy?: string;
	placeholder?: string;
}

const labels: Label[] = [
	{ value: 'IBAN', region: 'International' },
	{ value: 'SWIFT / BIC', region: 'International' },

	{ value: 'Name', region: 'Australia' },
	{ value: 'BSB', region: 'Australia', placeholder: 'XXX-XXX' },
	{ value: 'Acc #', region: 'Australia', fuzzy: 'Account Number', placeholder: 'XXX XXX XXX' },

	{ value: 'Bank Acc #', region: 'New Zealand', fuzzy: 'Account Number' },

	{ value: 'Sort Code', region: 'UK', fuzzy: 'United Kingdom' },
	{ value: 'Acc #', region: 'UK', fuzzy: 'United Kingdom, Account Number' },

	{ value: 'Institution #', region: 'Canada' },
	{ value: 'Transit #', region: 'Canada', fuzzy: 'Transit Number' },
	{ value: 'Account #', region: 'Canada', fuzzy: 'Account Number' },
].map(tag => ({ id: `${tag.region}-${tag.value}`, ...tag }));

function fuzzyFilter(item: Label, query: string): boolean {
	if (!query) return true;

	const results = matchSorter([item], query, {
		keys: [
			'value',
			'region',
			'fuzzy',
			{ key: 'value', threshold: matchSorter.rankings.CONTAINS },
			{ key: 'region', threshold: matchSorter.rankings.CONTAINS },
			{ key: 'fuzzy', threshold: matchSorter.rankings.CONTAINS },
		],
	});

	return results.length > 0;
}
