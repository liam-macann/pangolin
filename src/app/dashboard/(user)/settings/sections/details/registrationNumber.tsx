'use client';

import { TrashIcon } from '@phosphor-icons/react';
import { type Control, Controller, type FieldValues, useFieldArray } from 'react-hook-form';
import { type z } from 'zod';

import { type config as configSchema } from '@/lib/validation/config';

import {
	Sortable,
	SortableActions,
	SortableEmpty,
	SortableHandle,
	SortableItem,
	SortableList,
} from '@/components/sortable-input';
import { Button } from '@/ui/button';
import { DropdownMenuItem } from '@/ui/dropdown-menu';
import { Field, FieldError, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';

interface FormValues extends FieldValues {
	registrationNumber: z.infer<typeof configSchema.shape.registrationNumber>;
}

export function RegistrationNumberField<T extends FormValues>({
	control: _control,
	className,
}: {
	control: Control<T>;
	className?: string;
}) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<FormValues>;

	const { fields, append, remove, move } = useFieldArray({ control, name: 'registrationNumber' });
	const addLine = () => append({ label: '', value: '' });

	return (
		<Sortable
			className={className}
			items={fields}
			onReorder={({ initialIndex, index }) => move(initialIndex, index)}
		>
			<SortableEmpty className='flex items-center justify-between gap-2 rounded-lg border border-dotted p-6 py-7'>
				<p className='font-medium text-muted-foreground text-sm'>No trading number provided</p>
				<Button onClick={addLine}>Add Number</Button>
			</SortableEmpty>

			<div className='grid grid-cols-[1rem_1fr_2fr_2.25rem] gap-2 group-data-[empty]/sortable:hidden'>
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
				<Button size={'sm'} onClick={addLine}>
					Add Number
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
	return (
		<SortableItem id={id} index={index} className='grid grid-cols-[1rem_1fr_2fr_2.25rem]'>
			<SortableHandle />

			<Controller
				control={control}
				name={`registrationNumber.${index}.label`}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid}>
						<Input type='text' placeholder='eg. ABN' {...field} />
						{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
					</Field>
				)}
			/>
			<Controller
				control={control}
				name={`registrationNumber.${index}.value`}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid}>
						<Input type='text' {...field} className='tabular-nums' />
						{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
					</Field>
				)}
			/>
			<SortableActions align='center'>{children}</SortableActions>
		</SortableItem>
	);
}
