'use client';

import { InfoIcon, TrashIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import {
	type Control,
	Controller,
	type FieldArrayWithId,
	type UseFieldArrayReturn,
	useFieldArray,
	useFormContext,
	useFormState,
	useWatch,
} from 'react-hook-form';
import type z from 'zod/v4';

import { cn } from '@/lib/utils';
import { type config as formSchema } from '@/lib/validation/config';

import { InfoTip } from '@/components/info';
import {
	Sortable,
	SortableActions,
	SortableEmpty,
	SortableHandle,
	SortableItem,
	SortableList,
} from '@/components/sortable-input';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { Button } from '@/ui/button';
import { DropdownMenuItem } from '@/ui/dropdown-menu';
import { EmptyDescription } from '@/ui/empty';
import { Field, FieldError, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/input-group';

type FormValues = z.input<typeof formSchema>;
type Fields = Pick<FormValues, 'taxRegistration' | 'taxes'>;

export function TaxRateField<T extends Fields>({
	className,
	// Control is not necessary when using FormProvider, but provides type guard
	control: _control,
}: {
	className?: string;
	control: Control<T>;
}) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<Fields>;

	const { fields, ...actions } = useFieldArray({ control, name: 'taxes' });
	const addTax = () => actions.append({ name: '', rate: '' });

	return (
		<Sortable
			className={cn('flex flex-col gap-2', className)}
			items={fields}
			onReorder={({ initialIndex, index }) => actions.move(initialIndex, index)}
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
				{(tax, i) => <TaxRow key={tax.id} tax={tax} index={i} actions={actions} />}
			</SortableList>

			<SortableEmpty>
				<EmptyDescription className='font-medium'>No taxes configured</EmptyDescription>
				<Button onClick={addTax}>Add Tax</Button>
			</SortableEmpty>

			<Button
				size='sm'
				className='mt-3 self-end group-data-[empty]/sortable:hidden'
				onClick={addTax}
			>
				Add Tax
			</Button>
		</Sortable>
	);
}

function TaxRow({
	tax,
	index,
	actions,
}: {
	tax: FieldArrayWithId<Fields, 'taxes', 'id'>;
	index: number;
	actions: Omit<UseFieldArrayReturn<Fields, 'taxes'>, 'fields'>;
}) {
	const { trigger, control } = useFormContext<Fields>();

	const { errors } = useFormState<Fields>({ name: `taxes.${index}` });
	const itemErrors = errors.taxes?.[index];

	return (
		<SortableItem
			id={tax.id}
			index={index}
			className='grid grid-cols-[1.5rem_1fr_1fr_2.25rem] gap-y-0.5'
		>
			<SortableHandle />

			<Controller
				control={control}
				name={`taxes.${index}.name`}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid || !!itemErrors?.message}>
						<Input
							type='text'
							placeholder='eg. VAT'
							{...field}
							onChange={e => {
								field.onChange(e);

								// Condition allows error to be dismissed, but will not reappear until form revalidation is triggered.
								// It is really annoying to see the error flash when typing.
								if (itemErrors?.type === 'custom') trigger('taxes');
							}}
						/>
						{fieldState.invalid && <FieldError className='text-xs' errors={[fieldState.error]} />}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name={`taxes.${index}.rate`}
				render={({ field, fieldState }) => (
					<Field className='gap-0.5' data-invalid={fieldState.invalid || !!itemErrors?.message}>
						<InputGroup>
							<InputGroupInput
								type='number'
								min='0'
								max='200'
								step='any'
								inputMode='decimal'
								placeholder='--'
								onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
								{...field}
								onChange={e => {
									field.onChange(e);

									// Condition allows error to be dismissed, but will not reappear until form revalidation is triggered.
									// It is really annoying to see the error flash when typing.
									if (itemErrors?.type === 'custom') trigger('taxes');
								}}
							/>
							<InputGroupAddon align='inline-end'>%</InputGroupAddon>
						</InputGroup>
						<FieldError className='text-xs' errors={[fieldState.error]} />
					</Field>
				)}
			/>

			<SortableActions align='center'>
				<DropdownMenuItem variant='destructive' onClick={() => actions.remove(index)}>
					<TrashIcon />
					Delete
				</DropdownMenuItem>
			</SortableActions>

			<FieldError
				className='col-span-3 col-start-2 text-xs'
				errors={itemErrors?.message ? [{ message: itemErrors?.message }] : undefined}
			/>
		</SortableItem>
	);
}

export function DuplicateWarning<T extends Fields>({
	control: _control,
	className,
}: {
	control: Control<T>;
	className?: string;
}) {
	const control = _control as unknown as Control<Fields>;

	const taxes = useWatch({ control, name: 'taxes' });
	const names = taxes?.map(tax => tax.name).filter(name => name.trim() !== '') || [];

	const areDuplicates = new Set(names).size !== names.length;

	const transition = {
		type: 'spring',
		mass: 0.2,
		stiffness: 270,
		damping: 15,
	} as const;

	const variants = {
		visible: {
			height: 'auto',
			opacity: 1,
			scale: 1,
			filter: 'blur(0px)',
			transition,
		},
		hidden: {
			height: 0,
			opacity: 0,
			filter: 'blur(1px)',
			transition,
		},
	};

	return (
		<AnimatePresence initial={false}>
			{areDuplicates && (
				<motion.div variants={variants} initial='hidden' animate='visible' exit='hidden' layout>
					<div className={className}>
						<Alert>
							<InfoIcon />
							<AlertTitle>Duplicate tax names</AlertTitle>
							<AlertDescription>
								When multiple taxes share the same label, a single subtotal item will aggregate all
								rates. The specific rate applicable remains visible on each line item.
							</AlertDescription>
						</Alert>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
