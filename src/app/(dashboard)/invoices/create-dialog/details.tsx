'use client';

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { CaretUpDownIcon } from '@phosphor-icons/react/ssr';
import { type ComponentProps, type Ref, Suspense, useId, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useClients } from '@/lib/hooks';
import { useFetchNearEnd } from '@/lib/hooks/data/helpers';
import { cn } from '@/lib/utils';

import { InfoTip } from '@/components/info';
import { Button } from '@/ui/button';
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@/ui/combobox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/ui/field';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';

import { type CreateInvoiceDraft } from './schema';

export function InvoiceDetails() {
	const { control } = useFormContext<CreateInvoiceDraft>();

	return (
		<>
			<FieldGroup className='gap-4'>
				<Suspense fallback={<BillToCombobox items={[]} loading />}>
					<BillTo />
				</Suspense>

				<Controller
					name='title'
					control={control}
					render={({ field, fieldState }) => (
						<Field orientation='horizontal'>
							<FieldLabel htmlFor='title' className='mt-4.5 grow-0! -translate-y-1/2 self-start'>
								Title
							</FieldLabel>
							<div className='flex grow flex-col items-end gap-1'>
								<Input
									id='title'
									placeholder='Optional'
									{...field}
									value={field.value ?? ''}
									className='max-w-80'
								/>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</div>
						</Field>
					)}
				/>
			</FieldGroup>

			<details className='mt-4'>
				<Button
					size='sm'
					variant='ghost'
					className='-ml-3! text-muted-foreground'
					nativeButton={false}
					render={
						<summary>
							More <CaretUpDownIcon />
						</summary>
					}
				/>
				<FieldGroup className='gap-4'>
					<Controller
						name='description'
						control={control}
						render={({ field, fieldState }) => (
							<Field orientation='responsive'>
								<FieldLabel
									htmlFor='description'
									className='@md/field-group:mt-4.5 @md/field-group:-translate-y-1/2 self-start'
								>
									Description
									<InfoTip side='right'>Printed below the invoice reference</InfoTip>
								</FieldLabel>
								<div className='flex flex-col gap-1'>
									<Textarea
										id='description'
										placeholder='Optional'
										{...field}
										className='@md/field-group:w-80'
									/>
									{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
								</div>
							</Field>
						)}
					/>
				</FieldGroup>
			</details>
		</>
	);
}

function BillTo() {
	const { control } = useFormContext<CreateInvoiceDraft>();
	const items = useClients({
		select: clients =>
			clients.map(client => ({
				value: client.data.scdId,
				label: client.data.name ?? client.data.organization ?? client.data.email,
			})),
	});

	// A controlled filter renders the matches in the same commit as this component,
	// so the check below measures the filtered list
	const { contains } = ComboboxPrimitive.useFilter();
	const [search, setSearch] = useState('');

	const matches = search
		? items.data.filter(item => contains(item, search, ({ label }) => label))
		: items.data;

	// Search only filters the loaded items, so keep loading new pages while the end of the list is in view
	const listRef = useRef<HTMLDivElement>(null);
	const onScroll = useFetchNearEnd(items, listRef);

	return (
		<Controller
			name='clientDataId'
			control={control}
			render={({ field, fieldState }) => (
				<BillToCombobox
					errors={fieldState.invalid ? [fieldState.error] : undefined}
					items={items.data}
					filteredItems={matches}
					{...field}
					value={items.data.find(item => item.value === (field.value || '')) || null}
					onValueChange={value => field.onChange(value?.value)}
					ref={listRef}
					onScroll={onScroll}
					onInputValueChange={(value, { reason }) =>
						setSearch(reason === 'input-change' ? value.trim() : '')
					}
				/>
			)}
		/>
	);
}

function BillToCombobox({
	errors,
	loading = false,
	ref,
	onScroll,
	...props
}: {
	errors?: ComponentProps<typeof FieldError>['errors'];
	loading?: boolean;
	ref?: Ref<HTMLDivElement>;
} & ComboboxPrimitive.Root.Props<{ value: string; label: string }> &
	Pick<ComboboxPrimitive.List.Props, 'onScroll'>) {
	const id = useId();

	return (
		<Field orientation='horizontal'>
			<FieldLabel htmlFor={id} className='mt-4.5 grow-0! -translate-y-1/2 self-start'>
				Bill To
			</FieldLabel>
			<div className='flex grow flex-col items-end gap-1'>
				<Combobox id={id} disabled={loading} {...props}>
					<ComboboxInput
						id={id}
						disabled={loading}
						className={cn('w-full max-w-80', loading && '*:disabled:cursor-wait')}
						placeholder='e.g. John Smith'
					/>
					<ComboboxContent>
						<ComboboxEmpty>No clients found.</ComboboxEmpty>
						<ComboboxList ref={ref} onScroll={onScroll}>
							{item => (
								<ComboboxItem key={item.value} value={item}>
									{item.label}
								</ComboboxItem>
							)}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>

				{errors && <FieldError errors={errors} />}
			</div>
		</Field>
	);
}
