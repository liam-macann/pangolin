'use client';

import { WarningCircleIcon, WarningIcon } from '@phosphor-icons/react/ssr';
import { type CountryCode, isValidCountryCode } from 'lib-address';
import { ErrorBoundary } from 'react-error-boundary';
import { type Control, useWatch } from 'react-hook-form';
import type z from 'zod';

import { useAddressMetadata } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import type schema from '@/lib/validation/address';

import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { FieldSet } from '@/ui/field';

import { Country, FIELD_MAPPING, type FieldProps } from './fields';

type AddressField = z.input<typeof schema>;
export interface FormValues {
	address: AddressField | null;
}

/** Generic address format including standard international fields
 * @remarks Intentionally deviates from Google 'ZZ' fmt, to more closely mirror regions in loading skeleton
 */
const intlFmt = '%N%n%O%n%A%n%C, %S %Z';

export function AddressInput<T extends FormValues>({
	control: _control,
	disabled,
}: {
	control: Control<T>;
	disabled?: boolean;
}) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<FormValues>;
	const region = useWatch({ name: 'address.country', control });

	return (
		<FieldSet
			className={cn(
				'isolate min-w-0 gap-0 rounded-md border border-dotted bg-background dark:bg-secondary',
				'transition duration-150 ease-out-quart',
				disabled &&
					'cursor-not-allowed bg-muted opacity-50 *:pointer-events-none **:disabled:opacity-100!',
			)}
		>
			<ErrorBoundary
				fallback={
					<Alert variant='destructive' className='!w-auto m-2'>
						<WarningIcon />
						<AlertTitle>
							Something went wrong! Check your network connection and try again later.
						</AlertTitle>
					</Alert>
				}
			>
				{(region && <LocaleForm disabled={disabled} region={region} />) || (
					<Fields disabled={disabled} metadata={{ fmt: intlFmt }} />
				)}
			</ErrorBoundary>

			<Country disabled={disabled} />
		</FieldSet>
	);
}

/** Takes an ISO2 string and renders localised address input */
function LocaleForm({ region, disabled }: { region: CountryCode; disabled?: boolean }) {
	if (!isValidCountryCode(region)) throw new Error(`Invalid country code: ${region}`);

	// Fetch region from cache or Google Address Metadata API
	const { data, isLoading, error } = useAddressMetadata(region, undefined, {
		keepPreviousData: true,
	});

	if (error || (!isLoading && !data))
		return (
			<Alert variant='destructive' className='m-2 mb-1 w-auto rounded-sm'>
				<WarningCircleIcon />
				<AlertTitle>Failed to load address format</AlertTitle>
				<AlertDescription>Please refresh the page, and try again later.</AlertDescription>
			</Alert>
		);

	return (
		<Fields
			disabled={isLoading || disabled}
			metadata={data ?? { fmt: intlFmt }}
			className={cn(
				'transition-colors duration-300 ease-out-quad',
				isLoading &&
					'animate-pulse cursor-progress bg-muted delay-75 *:pointer-events-none **:delay-75',
			)}
		/>
	);
}

/** Render fields from field mapping */
function Fields({ className, ...props }: FieldProps & { className?: string }) {
	// Not every region has a defined format (eg. Antarctica).
	// API route merges with generic 'ZZ' region, but this acts as a fallback.
	const rawFmt = props.metadata?.lfmt || props.metadata?.fmt || intlFmt;

	/** Keeps track of rendered fields to ensure components are included only once */
	const seen = new Set<string>();
	const fmt = rawFmt
		.split('%n')
		//
		// Split by field markers, discarding literals
		// Exclude name and org fields
		.map(v => v.match(/(%[A-Za-z])/g)?.filter(part => !['', '%N', '%O'].includes(part)) || [])
		//
		// Certain country fmt strings include a field twice (eg. Côte d'Ivoire and sorting codes)
		.map(arr =>
			arr.filter(v => {
				if (v[0] !== '%' || seen.has(v)) return false;
				seen.add(v);
				return true;
			}),
		)
		.filter(arr => arr.length > 0);

	return (
		<>
			{fmt?.map((arr, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: Index corresponds to address line number
					key={i}
					className={cn(
						'group/address-line flex border-b border-dotted empty:hidden focus-within:z-10 md:text-sm',
						className,
					)}
				>
					{arr.map(v => {
						// Discard literals
						if (v[0] !== '%') return null;

						const Component = FIELD_MAPPING[v.substring(1)];
						return <Component key={v} {...props} />;
					})}
				</div>
			))}
		</>
	);
}
