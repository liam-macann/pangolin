import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { PlusIcon } from '@phosphor-icons/react';
import { getZipExamples } from 'lib-address';
import { type ChangeEvent, type ReactNode, useEffect, useId, useRef } from 'react';
import {
	Controller,
	type ControllerRenderProps,
	type UseFormReturn,
	useFormContext,
	useWatch,
} from 'react-hook-form';
import type { AddressMetadata } from '@/lib/hooks';
import mergeRefs, { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
} from '@/ui/combobox';
import { Field, FieldContent, FieldError, FieldLabel, FieldTitle } from '@/ui/field';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import TextTooltip from '@/ui/tooltip';
import { RegionSelectContent, RegionSelectRoot } from '../region-select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import type { FormValues } from '.';

export interface FieldProps {
	metadata: Partial<AddressMetadata>;
	disabled?: boolean;
}

export const ConnectForm = ({
	children,
}: {
	children: (props: UseFormReturn<FormValues>) => ReactNode;
}) => {
	const methods = useFormContext<FormValues>();
	return children(methods);
};

//
//
// COMPONENT WRAPPERS
//
export const AddressField = ({ className, ...props }: React.ComponentProps<typeof Field>) => (
	<Field className={cn('!p-3 h-full gap-1', className)} {...props} />
);

export const AddressLabel = ({ className, ...props }: React.ComponentProps<typeof FieldLabel>) => (
	<FieldLabel
		className={cn(
			'group-first/address-line:first:!rounded-tl-md group-first/address-line:last:!rounded-tr-md has-[>[data-slot=field]]:rounded-none',
			'min-w-0',
			'border-none focus-within:ring-2',
			className,
		)}
		{...props}
	/>
);

export const AddressContent = ({
	className,
	...props
}: React.ComponentProps<typeof FieldContent>) => (
	<FieldContent className={cn('h-full gap-0.5', className)} {...props} />
);

export const AddressTitle = ({ className, ...props }: React.ComponentProps<typeof FieldTitle>) => (
	<FieldTitle className={cn('capitalize', className)} {...props} />
);

export const AddressError = ({ className, ...props }: React.ComponentProps<typeof FieldError>) => (
	<FieldError className={cn('text-xs', className)} {...props} />
);

const inputResetClass =
	'border-none !ring-0 !bg-transparent rounded-none overflow-visible shadow-none p-0 h-auto';
export const AddressInput = ({ className, ...props }: React.ComponentProps<typeof Input>) => (
	<Input className={cn(inputResetClass, className)} {...props} />
);

//
//
//
// INPUT COMPONENTS
//

const StreetAddress = ({ disabled }: FieldProps) => {
	const id = useId();

	const ref = useRef<HTMLTextAreaElement>(null);

	return (
		<ConnectForm>
			{({ control, setValue, getValues }) => (
				<Controller
					control={control}
					shouldUnregister
					name='address.streetAddress'
					render={({ field, fieldState }) => {
						const numberOfLines = field.value?.length || 0;
						const maxLines = 4;

						return (
							<AddressLabel htmlFor={id} className='relative basis-[200%]'>
								<AddressField className='!pb-0.5' data-invalid={fieldState.invalid}>
									<AddressContent>
										<AddressTitle>Street Address</AddressTitle>
										{fieldState.invalid && <AddressError errors={[fieldState.error]} />}
									</AddressContent>

									<Textarea
										className={cn(
											inputResetClass,
											'h-auto min-h-10 resize-none text-nowrap font-normal leading-10',
										)}
										style={{
											marginTop: 'calc(var(--spacing) * -2.5)',
											// Divide each line with horizontal rule
											background: `repeating-linear-gradient(
                				  0deg,
                          color-mix(in srgb, var(--color-input), transparent 40%),
                          color-mix(in srgb, var(--color-input), transparent 40%) 1px,
                          transparent 1px,
                          transparent 1lh)`,
											// Hide final line
											maskImage: `linear-gradient(to top, transparent 2px, black 2px)`,
										}}
										autoComplete='street-address'
										disabled={disabled}
										id={id}
										{...field}
										ref={mergeRefs(ref, field.ref)}
										value={field.value?.join('\n') || ''}
										// Ensure pasted values etc. do not exceed maxLines
										onChange={e => field.onChange(e.target.value.split('\n', maxLines))}
										// Cancel Enter key if maxLines reached
										onKeyDown={e => {
											if (e.key === 'Enter' && numberOfLines >= maxLines) e.preventDefault();
										}}
									/>
								</AddressField>

								<TextTooltip
									content='Add address line'
									render={
										<Button
											size='icon-xs'
											className='absolute top-2 right-2'
											aria-label='Add address line'
											disabled={disabled || numberOfLines >= maxLines}
											onClick={() => {
												const v = getValues('address.streetAddress');
												setValue('address.streetAddress', [...(v || []), ''], {
													shouldDirty: true,
												});

												ref.current?.focus();
												const length = ref.current?.value.length ?? 0;
												ref.current?.setSelectionRange(length, length);
											}}
										>
											<PlusIcon />
										</Button>
									}
								/>
							</AddressLabel>
						);
					}}
				/>
			)}
		</ConnectForm>
	);
};

const DependentLocality = ({ metadata, disabled }: FieldProps) => {
	const id = useId();

	return (
		<ConnectForm>
			{({ control }) => (
				<Controller
					control={control}
					shouldUnregister
					name='address.dependentLocality'
					render={({ field, fieldState }) => (
						<AddressLabel htmlFor={id}>
							<AddressField data-invalid={fieldState.invalid}>
								<AddressContent>
									<AddressTitle>{metadata?.sublocality_name_type || 'Suburb'}</AddressTitle>
									{fieldState.invalid && <AddressError errors={[fieldState.error]} />}
								</AddressContent>
								<AddressInput
									autoComplete='address-level3'
									disabled={disabled}
									id={id}
									{...field}
									// Force controlled field
									value={field.value || ''}
								/>
							</AddressField>
						</AddressLabel>
					)}
				/>
			)}
		</ConnectForm>
	);
};

const City = ({ metadata, disabled }: FieldProps) => {
	const id = useId();

	return (
		<ConnectForm>
			{({ control }) => (
				<Controller
					control={control}
					shouldUnregister
					name='address.city'
					render={({ field, fieldState }) => (
						<AddressLabel htmlFor={id}>
							<AddressField data-invalid={fieldState.invalid}>
								<AddressContent>
									<AddressTitle>{metadata?.locality_name_type || 'City'}</AddressTitle>
									{fieldState.invalid && <AddressError errors={[fieldState.error]} />}
								</AddressContent>
								<AddressInput
									autoComplete='address-level2'
									disabled={disabled}
									id={id}
									{...field}
									// Force controlled field
									value={field.value || ''}
								/>
							</AddressField>
						</AddressLabel>
					)}
				/>
			)}
		</ConnectForm>
	);
};

const AdministrativeArea = ({ metadata, disabled }: FieldProps) => {
	const id = useId();

	return (
		<ConnectForm>
			{({ control, trigger, formState, getFieldState }) => (
				<Controller
					control={control}
					shouldUnregister
					name='address.administrativeArea'
					render={({ field, fieldState }) => {
						function onChange(e: ChangeEvent<HTMLInputElement>) {
							field.onChange(e);

							// Trigger rerender due to dependent validation
							if (formState.isSubmitted || getFieldState('address.postalCode').invalid) {
								trigger('address.postalCode');
							}
						}

						return (
							<AddressLabel htmlFor={id}>
								<AddressField data-invalid={fieldState.invalid}>
									<AddressContent>
										<AddressTitle>{metadata?.state_name_type || 'State / Province'}</AddressTitle>
										{fieldState.invalid && <AddressError errors={[fieldState.error]} />}
									</AddressContent>
									{metadata?.sub_regions ? (
										<AdministrativeAreaCombobox
											metadata={metadata}
											disabled={disabled}
											id={id}
											data-invalid={fieldState.invalid}
											{...field}
											onChange={onChange}
										/>
									) : (
										<AddressInput
											autoComplete='address-level1'
											disabled={disabled}
											id={id}
											{...field}
											// Force controlled field
											value={field.value || ''}
											onChange={onChange}
										/>
									)}
								</AddressField>
							</AddressLabel>
						);
					}}
				/>
			)}
		</ConnectForm>
	);
};

const AdministrativeAreaCombobox = ({
	metadata,
	disabled,
	id,
	value,
	onChange,
	...props
}: FieldProps & { id: string } & ControllerRenderProps) => {
	if (!metadata.sub_regions) throw new Error('Sub keys required for AdministrativeAreaCombobox');

	const items = metadata.sub_regions.map(subregion => ({
		value: subregion.key,
		label: subregion.name.latin || subregion.name.default || subregion.key,
	}));

	// It is unpredictable whether autofill systems will input abbreviations or longform values. This will match with both.
	// Assumption: no overlap in values and labels
	const val = items.find(item => item.value === value || item.label === value) || null;

	// Necessary as onValueChange is not fired when val defaults to null.
	//
	// If you select a value, and then change the region to another country where this value is
	// invalid, the combobox will not reset the value. This causes a mismatch between UI and internal state.
	// The internal state will reappear in the UI when changing to a region where this original value is valid.
	useEffect(() => {
		if (!val) onChange('');
	}, [val, onChange]);

	return (
		<Combobox
			disabled={disabled}
			items={items}
			value={val}
			onValueChange={v => onChange(v?.value || '')}
			isItemEqualToValue={(item, selected) => item.value === selected.value}
			{...props}
		>
			<InputGroup data-disabled={disabled} className={inputResetClass}>
				<ComboboxPrimitive.Input
					id={id}
					render={<InputGroupInput disabled={disabled} />}
					className={'h-auto p-0'}
					disabled={disabled}
					placeholder={`Select ${metadata?.state_name_type || 'area'}…`}
					autoComplete='address-level1'
				/>

				<InputGroupAddon className='p-0' align='inline-end'>
					<ComboboxTrigger
						render={<Button size='icon-xs' variant='ghost' />}
						data-slot='input-group-button'
						className='-my-3 data-pressed:bg-transparent'
						disabled={disabled}
					/>
				</InputGroupAddon>
			</InputGroup>

			<ComboboxContent className='-translate-x-1'>
				<ComboboxEmpty>No items found.</ComboboxEmpty>
				<ComboboxList>
					{(item: typeof val) =>
						item && (
							<ComboboxItem key={item.value} value={item}>
								{item.label}
							</ComboboxItem>
						)
					}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
};

const PostalCode = ({ metadata, disabled }: FieldProps) => {
	const id = useId();
	const administrativeArea: string | undefined =
		useWatch({ name: 'address.administrativeArea' }) ?? undefined;

	return (
		<ConnectForm>
			{({ control }) => (
				<Controller
					control={control}
					shouldUnregister
					name='address.postalCode'
					render={({ field, fieldState }) => {
						const example = metadata.key && getZipExamples(metadata.key, administrativeArea);

						const title = (() => {
							switch (metadata?.zip_name_type) {
								case 'zip':
									return 'ZIP Code';
								case 'eircode':
									return 'Eircode';
								case 'pin':
									return 'PIN';
								default:
									return 'Postal Code';
							}
						})();

						return (
							<AddressLabel htmlFor={id}>
								<AddressField data-invalid={fieldState.invalid}>
									<AddressContent>
										<AddressTitle>{title}</AddressTitle>

										{fieldState.invalid && <AddressError errors={[fieldState.error]} />}
									</AddressContent>
									<AddressInput
										autoComplete='postal-code'
										disabled={disabled}
										id={id}
										placeholder={example?.[0]}
										{...field}
										// Force controlled field
										value={field.value || ''}
									/>
								</AddressField>
							</AddressLabel>
						);
					}}
				/>
			)}
		</ConnectForm>
	);
};

const SortingCode = ({ disabled }: FieldProps) => {
	const id = useId();

	return (
		<ConnectForm>
			{({ control }) => (
				<Controller
					control={control}
					shouldUnregister
					name='address.sortingCode'
					render={({ field, fieldState }) => (
						<AddressLabel htmlFor={id}>
							<AddressField data-invalid={fieldState.invalid}>
								<AddressContent>
									<AddressTitle>CEDEX</AddressTitle>
									{fieldState.invalid && <AddressError errors={[fieldState.error]} />}
								</AddressContent>
								<AddressInput
									disabled={disabled}
									id={id}
									{...field}
									// Force controlled field
									value={field.value || ''}
								/>
							</AddressField>
						</AddressLabel>
					)}
				/>
			)}
		</ConnectForm>
	);
};

export const Country = ({ disabled }: Omit<FieldProps, 'metadata'>) => {
	const id = useId();

	return (
		<ConnectForm>
			{({ control, trigger, formState }) => {
				return (
					<Controller
						control={control}
						name='address.country'
						render={({ field, fieldState }) => {
							return (
								<AddressLabel htmlFor={id} className='!rounded-b-md focus-within:z-10'>
									<AddressField data-invalid={fieldState.invalid}>
										<AddressContent>
											<AddressTitle className='normal-case'>Country or Territory</AddressTitle>
											{fieldState.invalid && <AddressError errors={[fieldState.error]} />}
										</AddressContent>

										<RegionSelectRoot
											disabled={disabled}
											{...field}
											onValueChange={v => {
												field.onChange(v?.iso2 || null);
												// Trigger rerender due to dependent validation
												// isSubmitted indicates form is revalidating (which triggers schema onChange)
												if (formState.isSubmitted) trigger('address');
											}}
										>
											<InputGroup className={inputResetClass}>
												<ComboboxPrimitive.Input
													id={id}
													render={<InputGroupInput />}
													className={'h-auto p-0'}
												/>

												<InputGroupAddon className='p-0' align='inline-end'>
													<ComboboxTrigger
														render={<Button size='icon-xs' variant='ghost' />}
														data-slot='input-group-button'
														className='-my-3 data-pressed:bg-transparent'
													/>
												</InputGroupAddon>
											</InputGroup>
											<RegionSelectContent className='-translate-x-1' />
										</RegionSelectRoot>
									</AddressField>
								</AddressLabel>
							);
						}}
					/>
				);
			}}
		</ConnectForm>
	);
};

/** Components that correspond to DB schema representation (from Google Address Metadata API) */
export const FIELD_MAPPING: Record<string, (props: FieldProps) => ReactNode> = {
	A: StreetAddress,
	D: DependentLocality,
	C: City,
	S: AdministrativeArea,
	Z: PostalCode,
	X: SortingCode,
};
