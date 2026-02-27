'use client';
import { InfoIcon, TrashIcon } from '@phosphor-icons/react';
import { createInsertSchema } from 'drizzle-zod';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import {
	type Control,
	type FieldArrayWithId,
	type FieldValues,
	type UseFieldArrayReturn,
	type UseFormReturn,
	useFieldArray,
	useFormContext,
	useFormState,
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
import { cn, type Prettify } from '@/lib/utils';
import { intlNumber } from '@/lib/zod';
import { Button } from '@/ui/button';
import { DropdownMenuItem } from '@/ui/dropdown-menu';
import { Field, FieldError, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/input-group';

export const taxArraySchema = z
	.array(
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
		}).pick({ name: true, rate: true }),
	)
	.superRefine((arr, ctx) => {
		const seen = new Map<string, number>();

		arr.forEach((item, index) => {
			/** Composite key of name and rate */
			const key = item.name + item.rate.toString();

			if (seen.has(key)) {
				// biome-ignore lint/style/noNonNullAssertion: Guarded in previous condition
				const firstIndex = seen.get(key)!;

				// Error on first and current duplicate item
				[index, firstIndex].forEach(path => {
					ctx.addIssue({
						code: 'custom',
						message: 'Taxes must not share identical label and rate',
						path: [path],
					});
				});
			} else seen.set(key, index);
		});
	});

type TaxField = Prettify<
	Pick<typeof taxes.$inferSelect, 'name'> & {
		/** Widened type to allow blank default value */
		rate: number | '';
	}
>;

interface FormValues extends FieldValues {
	taxes: TaxField[];
}

export const ConnectForm = ({
	children,
}: {
	children: (props: UseFormReturn<FormValues>) => ReactNode;
}) => {
	const methods = useFormContext<FormValues>();
	return children(methods);
};

export function TaxRateField<T extends FormValues>({
	className,
	// Control is not necessary when using FormProvider, but provides type guard
	control: _control,
}: {
	className?: string;
	control: Control<T>;
}) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<FormValues>;

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
				{fields.map((tax, i) => (
					<TaxRow key={tax.id} tax={tax} index={i} actions={actions} />
				))}
			</SortableList>

			<SortableEmpty className='ml-8 flex items-center justify-between gap-2 rounded-lg border border-dotted p-6 py-7'>
				<p className='font-medium text-muted-foreground text-sm'>No taxes configured</p>
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
	tax: FieldArrayWithId<FormValues, 'taxes', 'id'>;
	index: number;
	actions: Omit<UseFieldArrayReturn<FormValues, 'taxes'>, 'fields'>;
}) {
	const { errors } = useFormState<FormValues>({ name: `taxes.${index}` });
	const itemErrors = errors.taxes?.[index];

	return (
		<ConnectForm>
			{({ register, trigger }) => (
				<SortableItem
					id={tax.id}
					index={index}
					className='grid grid-cols-[1.5rem_1fr_1fr_2.25rem] gap-y-0.5'
				>
					<Field className='gap-0.5' data-invalid={!!itemErrors?.name || !!itemErrors?.message}>
						<Input
							type='text'
							placeholder='Label'
							{...register(`taxes.${index}.name`)}
							onChange={e => {
								register(`taxes.${index}.name`).onChange(e);

								// Condition allows error to be dismissed, but will not reappear until form revalidation is triggered.
								// It is really annoying to see the error flash when typing.
								if (itemErrors?.type === 'custom') trigger('taxes');
							}}
						/>
						<FieldError className='text-xs' errors={[itemErrors?.name]} />
					</Field>

					<Field className='gap-0.5' data-invalid={!!itemErrors?.rate || !!itemErrors?.message}>
						<InputGroup>
							<InputGroupInput
								type='text'
								inputMode='decimal'
								placeholder='eg. 12.5'
								step='any'
								onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
								{...register(`taxes.${index}.rate`)}
								onChange={e => {
									register(`taxes.${index}.rate`).onChange(e);

									// Condition allows error to be dismissed, but will not reappear until form revalidation is triggered.
									// It is really annoying to see the error flash when typing.
									if (itemErrors?.type === 'custom') trigger('taxes');
								}}
							/>
							<InputGroupAddon align='inline-end'>%</InputGroupAddon>
						</InputGroup>
						<FieldError className='text-xs' errors={[itemErrors?.rate]} />
					</Field>

					<SortableActions>
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
			)}
		</ConnectForm>
	);
}

export function DuplicateWarning<T extends FormValues>({
	control: _control,
	className,
}: {
	control: Control<T>;
	className?: string;
}) {
	const control = _control as unknown as Control<FormValues>;

	const taxes = useWatch({ control, name: 'taxes' });
	const names = taxes.map(tax => tax.name).filter(name => name.trim() !== '');

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
