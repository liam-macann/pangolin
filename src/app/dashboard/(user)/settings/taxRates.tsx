'use client';
import { InfoIcon, TrashIcon } from '@phosphor-icons/react';
import { createInsertSchema } from 'drizzle-zod';
import {
	type Control,
	Controller,
	type FieldValues,
	useFieldArray,
	useWatch,
} from 'react-hook-form';
import { z } from 'zod';
import { InfoTip } from '@/components/info';
import {
	Sortable,
	SortableActions,
	SortableEmpty,
	SortableItem,
	SortableList,
} from '@/components/sortable-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { taxes } from '@/db/schema';
import type { Prettify } from '@/lib/utils';
import { intlNumber } from '@/lib/zod';
import { Button } from '@/ui/button';
import { DropdownMenuItem } from '@/ui/dropdown-menu';
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@/ui/field';
import { Input } from '@/ui/input';

export const taxArraySchema = z.array(
	createInsertSchema(taxes, {
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
	}).pick({ name: true, rate: true, id: true }),
);

type TaxField = Prettify<
	Pick<typeof taxes.$inferSelect, 'name'> & {
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

	const { fields, append, remove, move } = useFieldArray({ control, name: 'taxes' });
	const addTax = () => append({ name: '', rate: '' });

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
				<DuplicateWarning control={control} />
				{state.error?.root && <FieldError errors={[state.error?.root]} />}
			</FieldContent>

			<Sortable
				className='flex flex-col gap-2'
				items={fields}
				onReorder={({ initialIndex, index }) => move(initialIndex, index)}
			>
				<div className='grid grid-cols-[1.5rem_1fr_1fr_2.25rem] gap-2 group-data-[empty]/sortable:hidden'>
					<FieldLabel className='col-start-2'>Label</FieldLabel>
					<FieldLabel>
						Rate
						<InfoTip side='right'>
							Simple percentage of item total. Compound taxes are not supported.
						</InfoTip>
					</FieldLabel>
				</div>
				<SortableList>
					{fields.map((tax, i) => (
						<SortableItem
							key={tax.id}
							id={tax.id}
							index={i}
							className='grid-cols-[1.5rem_1fr_1fr_2.25rem]'
						>
							<Controller
								control={control}
								name={`taxes.${i}.name`}
								render={({ field, fieldState }) => (
									<Field className='gap-0.5' data-invalid={fieldState.invalid}>
										<Input type='text' placeholder='Label' {...field} />
										{fieldState.invalid && (
											<FieldError className='text-xs' errors={[fieldState.error]} />
										)}
									</Field>
								)}
							/>
							<Controller
								control={control}
								name={`taxes.${i}.rate`}
								render={({ field, fieldState }) => (
									<Field className='gap-0.5' data-invalid={fieldState.invalid}>
										<Input
											suffix='%'
											type='text'
											inputMode='decimal'
											placeholder='2.5'
											step='any'
											onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
											{...field}
										/>
										{fieldState.invalid && (
											<FieldError className='text-xs' errors={[fieldState.error]} />
										)}
									</Field>
								)}
							/>
							<SortableActions>
								<DropdownMenuItem variant='destructive' onClick={() => remove(i)}>
									<TrashIcon />
									Delete
								</DropdownMenuItem>
							</SortableActions>
						</SortableItem>
					))}
				</SortableList>

				<SortableEmpty className='mb-7 ml-8 flex items-center justify-between gap-2 rounded-lg border border-dotted p-6 py-7'>
					<p className='font-medium text-muted-foreground text-sm'>No taxes configured</p>
					<Button onClick={addTax}>Add Tax</Button>
				</SortableEmpty>

				<Button className='mt-3 self-end group-data-[empty]/sortable:hidden' onClick={addTax}>
					Add Tax
				</Button>
			</Sortable>
		</FieldSet>
	);
}

function DuplicateWarning({ control }: { control: Control<FormValues> }) {
	const taxes = useWatch({ control, name: 'taxes' });
	const names = taxes.map(tax => tax.name).filter(name => name.trim() !== '');

	const areDuplicates = new Set(names).size !== names.length;

	return areDuplicates ? (
		<Alert className='mt-2'>
			<InfoIcon />
			<AlertTitle>Duplicate tax names</AlertTitle>
			<AlertDescription>
				When multiple taxes share the same name, a single subtotal item will be calculated. The
				specific rate applicable remains visible on each line item.
			</AlertDescription>
		</Alert>
	) : null;
}
