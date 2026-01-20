'use client';
import { TrashIcon } from '@phosphor-icons/react';
import { type Control, Controller, type FieldValues, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import {
	Sortable,
	SortableActions,
	SortableEmpty,
	SortableItem,
	SortableList,
} from '@/components/sortable-input';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { DropdownMenuItem } from '@/ui/dropdown-menu';
import { Field, FieldError, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';

export const registrationArraySchema = z
	.array(
		z.object({
			label: z.string().min(1, 'Please enter a label'),
			value: z.string().min(1, 'Please enter a value'),
		}),
	)
	.max(10, 'Too many registration numbers');

type RegistrationNumberField = z.infer<typeof registrationArraySchema>;

interface FormValues extends FieldValues {
	registrationNumber: RegistrationNumberField;
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
			className={cn('flex flex-col gap-2', className)}
			items={fields}
			onReorder={({ initialIndex, index }) => move(initialIndex, index)}
		>
			<SortableEmpty className='flex items-center justify-between gap-2 rounded-lg border border-dotted p-6 py-7'>
				<p className='font-medium text-muted-foreground text-sm'>No identifier provided</p>
				<Button onClick={addLine}>Add Number</Button>
			</SortableEmpty>

			<div className='grid grid-cols-[1.5rem_1fr_2fr_2.25rem] gap-2 group-data-[empty]/sortable:hidden'>
				<FieldLabel className='col-start-2'>Label</FieldLabel>
				<FieldLabel>Value</FieldLabel>
			</div>
			<SortableList>
				{fields.map((item, i) => (
					<Item key={item.id} id={item.id} index={i} control={control}>
						<DropdownMenuItem variant='destructive' onClick={() => remove(i)}>
							<TrashIcon />
							Delete
						</DropdownMenuItem>
					</Item>
				))}
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
		<SortableItem id={id} index={index} className='grid grid-cols-[1.5rem_1fr_2fr_2.25rem]'>
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
			<SortableActions>{children}</SortableActions>
		</SortableItem>
	);
}
